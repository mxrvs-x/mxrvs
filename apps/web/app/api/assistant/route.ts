import { createClient } from "@supabase/supabase-js";
import { assistantSystemPrompt } from "../../../lib/assistantContext";
import { recordsTool, retrieveFitnessRecords } from "../../../lib/assistantRecords";
import {
  CHAT_CONTEXT_LIMIT, CHAT_PROMPT_LIMIT, CHAT_REPLY_LIMIT, type ChatMessage,
} from "../../../../mobile/lib/assistantChat";

const MAX_BODY_BYTES = 256 * 1024;

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

function readToolCall(value: unknown): ToolCall | null {
  if (!value || typeof value !== "object") return null;
  const call = value as Partial<ToolCall>;
  if (call.type !== "function" || typeof call.id !== "string" || call.id.length > 128
    || call.function?.name !== recordsTool.function.name || typeof call.function.arguments !== "string") return null;
  return { type: call.type, id: call.id, function: { name: call.function.name, arguments: call.function.arguments } };
}

function reply(body: { message: string } | { error: string }, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function parseMessages(body: unknown): ChatMessage[] | null {
  if (!body || typeof body !== "object" || !("messages" in body) || !Array.isArray(body.messages)) return null;
  const items = body.messages;
  if (!items.length || items.length > CHAT_CONTEXT_LIMIT || items.length % 2 === 0) return null;
  const messages: ChatMessage[] = [];
  for (const [index, item] of items.entries()) {
    const role = index % 2 === 0 ? "user" : "assistant";
    const limit = role === "user" ? CHAT_PROMPT_LIMIT : CHAT_REPLY_LIMIT;
    if (item?.role !== role || typeof item.content !== "string" || item.content.length > limit) return null;
    const content = item.content.trim();
    if (!content) return null;
    messages.push({ role, content });
  }
  return messages;
}

export async function POST(request: Request) {
  const token = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return reply({ error: "Sign in to use the assistant." }, 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const owner = process.env.AI_ASSISTANT_USER_ID?.trim();
  if (!url || !anonKey || !apiKey || !owner) {
    return reply({ error: "The assistant is awaiting server setup." }, 503);
  }

  let client;
  try {
    client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: {
        headers: { Authorization: `Bearer ${token}` },
        fetch: (input, init) => fetch(input, {
          ...init, cache: "no-store",
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(8_000)]),
        }),
      },
    });
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error?.status === 429 || (error && (!error.status || error.status >= 500))) {
      return reply({ error: "Could not verify your session. Try again." }, 503);
    }
    if (error || !user) return reply({ error: "Your session expired. Sign in again." }, 401);
    if (user.id !== owner) return reply({ error: "The assistant is unavailable for this account." }, 403);
  } catch {
    return reply({ error: "Could not verify your session. Try again." }, 503);
  }

  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return reply({ error: "This conversation is too large." }, 413);
  }
  let messages: ChatMessage[] | null;
  let deviceTimeZone: unknown;
  try {
    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) return reply({ error: "This conversation is too large." }, 413);
    const payload = JSON.parse(new TextDecoder().decode(body));
    messages = parseMessages(payload);
    deviceTimeZone = payload?.timeZone;
  } catch {
    return reply({ error: "Could not read the conversation." }, 400);
  }
  if (!messages) return reply({ error: "The conversation contains an invalid message." }, 400);

  try {
    const systemPrompt = assistantSystemPrompt(process.env.AI_ASSISTANT_PROFILE, deviceTimeZone);
    const history: unknown[] = [{ role: "system", content: systemPrompt }, ...messages];
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(38_000)]);
    const requestCompletion = (toolChoice: "auto" | "none", retry = false) => fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal,
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        reasoning_effort: "low",
        max_completion_tokens: 1_500,
        messages: history,
        tools: [recordsTool],
        tool_choice: toolChoice,
        ...(retry ? { temperature: 0.2 } : {}),
      }),
    });

    let usedRetry = false;
    async function complete(toolChoice: "auto" | "none") {
      const first = await requestCompletion(toolChoice);
      if (first.status !== 400) return first;
      const error = (await first.clone().json().catch(() => null))?.error;
      if (usedRetry || (!error?.failed_generation && error?.code !== "tool_use_failed")) return first;
      usedRetry = true;
      return requestCompletion(toolChoice, true);
    }

    // Allow a second lookup if Groq needs to refine the query after seeing the first results.
    for (let lookups = 0; lookups <= 2; lookups++) {
      const response = await complete(lookups < 2 ? "auto" : "none");
      if (response.status === 429) return reply({ error: "The assistant reached its request limit. Try again later." }, 429);
      if (!response.ok) {
        console.warn("Groq assistant request failed", { status: response.status, lookups });
        return reply({ error: "The assistant is temporarily unavailable. Try again." }, 502);
      }

      const result = (await response.json())?.choices?.[0]?.message;
      const calls: unknown = result?.tool_calls;
      if (Array.isArray(calls) && calls.length > 0) {
        const call = calls.length === 1 && lookups < 2 ? readToolCall(calls[0]) : null;
        if (!call) return reply({ error: "The assistant could not finish the records lookup. Try a narrower question." }, 502);

        const records = await retrieveFitnessRecords(client, owner, call.function.arguments);
        history.push(
          { role: "assistant", content: null, tool_calls: [call] },
          { role: "tool", tool_call_id: call.id, name: call.function.name, content: JSON.stringify(records) },
        );
        continue;
      }

      const content: unknown = result?.content;
      if (typeof content !== "string" || !content.trim()) {
        return reply({ error: "The assistant returned an empty reply. Try again." }, 502);
      }
      return reply({ message: content.trim().slice(0, CHAT_REPLY_LIMIT) });
    }
    return reply({ error: "The assistant could not finish the records lookup. Try a narrower question." }, 502);
  } catch {
    return reply({ error: "Could not reach the assistant. Try again." }, 502);
  }
}
