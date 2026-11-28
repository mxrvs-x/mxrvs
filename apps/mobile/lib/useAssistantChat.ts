import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_CONTEXT_LIMIT, CHAT_PROMPT_LIMIT, CHAT_STARTERS, type ChatMessage, type createAssistantStorage } from "./assistantChat";

export function useAssistantChat(client: SupabaseClient, endpoint: string, storage: ReturnType<typeof createAssistantStorage>) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "signedOut">("loading");
  const [starters, setStarters] = useState(0);
  const [sending, setSending] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const owner = useRef<string | null | undefined>(undefined);
  const readyOwner = useRef<string | null>(null);
  const starterIndex = useRef(0);

  const reset = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    setMessages([]);
    setDraft("");
    setSending(false);
    setError("");
  }, []);

  useEffect(() => {
    let generation = 0;
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id ?? null;
      if (owner.current === next) return;
      owner.current = next;
      readyOwner.current = null;
      const request = ++generation;
      reset();
      setStatus(next ? "loading" : "signedOut");
      setStorageError("");
      starterIndex.current = 0;
      setStarters(0);
      if (!next) return;
      void storage.load(next).then((saved) => {
        if (!active || request !== generation) return;
        setMessages(saved.messages);
        starterIndex.current = saved.starters;
        setStarters(saved.starters);
        if (saved.messages.at(-1)?.role === "user") setError("This message hasn’t received a reply yet.");
        readyOwner.current = next;
        setStatus("ready");
      }).catch(() => {
        if (!active || request !== generation) return;
        setStorageError("Saved chat is unavailable on this device.");
        readyOwner.current = next;
        setStatus("ready");
      });
    });
    return () => {
      active = false;
      owner.current = undefined;
      readyOwner.current = null;
      subscription.unsubscribe();
      pending.current?.abort();
      pending.current = null;
    };
  }, [client, reset, storage]);

  function save(userId: string, conversation: ChatMessage[]) {
    void storage.save(userId, { messages: conversation, starters: starterIndex.current }).then(() => {
      if (owner.current === userId) setStorageError("");
    }, () => {
      if (owner.current === userId) setStorageError("Could not save the chat on this device.");
    });
  }

  function clear() {
    const userId = owner.current;
    if (!userId || readyOwner.current !== userId) return;
    reset();
    starterIndex.current = (starterIndex.current + 1) % CHAT_STARTERS.length;
    setStarters(starterIndex.current);
    save(userId, []);
  }

  async function ask(conversation: ChatMessage[]) {
    const userId = owner.current;
    if (pending.current || !endpoint || !userId || readyOwner.current !== userId) return;
    const controller = new AbortController();
    pending.current = controller;
    setMessages(conversation);
    save(userId, conversation);
    setSending(true);
    setError("");

    try {
      const { data: { session } } = await client.auth.getSession();
      if (controller.signal.aborted) return;
      if (!session || session.user.id !== userId) throw new Error("Sign in to use the assistant.");
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.slice(-CHAT_CONTEXT_LIMIT),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.message !== "string") {
        throw new Error(typeof data?.error === "string" ? data.error : "The assistant is unavailable. Try again.");
      }
      if (!controller.signal.aborted && owner.current === userId) {
        const completed: ChatMessage[] = [...conversation, { role: "assistant", content: data.message }];
        setMessages(completed);
        save(userId, completed);
      }
    } catch (problem) {
      if (controller.signal.aborted) return;
      setError(problem instanceof TypeError || !(problem instanceof Error)
        ? "Could not connect to the assistant. Try again."
        : problem.message);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setSending(false);
      }
    }
  }

  function send(value: string) {
    const content = value.trim();
    if (!content || content.length > CHAT_PROMPT_LIMIT || pending.current || !endpoint
      || !owner.current || readyOwner.current !== owner.current) return;
    const previous = messages.at(-1)?.role === "user" ? messages.slice(0, -1) : messages;
    void ask([...previous, { role: "user", content }]);
    setDraft("");
  }

  return {
    messages, draft, setDraft, sending, error, storageError,
    ready: status === "ready",
    signedOut: status === "signedOut",
    starters: CHAT_STARTERS[starters], send, clear,
    retry: () => {
      if (messages.at(-1)?.role === "user") void ask(messages);
    },
  };
}
