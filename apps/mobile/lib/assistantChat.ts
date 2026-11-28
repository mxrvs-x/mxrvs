export type ChatMessage = { role: "user" | "assistant"; content: string };

export const ASSISTANT_NAME = "HERA";
export const ASSISTANT_FULL_NAME = "Health, Exercise and Recovery Assistant";

export const CHAT_PROMPT_LIMIT = 2_000;
export const CHAT_REPLY_LIMIT = 6_000;
export const CHAT_CONTEXT_LIMIT = 11;

export const CHAT_STARTERS = [
  ["What is my bench press PR?", "How many steps did I average over the last 7 days?", "Based on my recent training and sleep, what should I train next?"],
  ["Compare my protein intake with my target", "What was my longest walk this month?", "How much sleep did I average last week?"],
  ["How has my squat progressed recently?", "Compare my average weight over the last two weeks", "Suggest a short workout for a busy day"],
  ["Compare my cardio this week with last week", "How consistent have my macros been?", "What can I adjust for better workout recovery?"],
];

type SavedChat = { messages: ChatMessage[]; starters: number };
const SAVED_MESSAGE_LIMIT = 101;

export function createAssistantStorage(adapter: {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}) {
  let writes = Promise.resolve();
  const key = (owner: string) => `mxrvs-assistant-chat:v1:${owner}`;
  return {
    async load(owner: string): Promise<SavedChat> {
      await writes;
      const raw = await adapter.getItem(key(owner));
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved?.messages) && saved.messages.every((message: ChatMessage, index: number) =>
            message?.role === (index % 2 === 0 ? "user" : "assistant")
              && typeof message.content === "string" && message.content.trim().length > 0,
          )) {
            return {
              messages: saved.messages,
              starters: Number.isInteger(saved.starters) && CHAT_STARTERS[saved.starters] ? saved.starters : 0,
            };
          }
        } catch {
          // A corrupt local record can be replaced by the next conversation.
        }
      }
      return { messages: [], starters: 0 };
    },
    save(owner: string, chat: SavedChat) {
      const cap = chat.messages.length % 2 === 0 ? SAVED_MESSAGE_LIMIT - 1 : SAVED_MESSAGE_LIMIT;
      const value = JSON.stringify({ ...chat, messages: chat.messages.slice(-cap) });
      const write = writes.then(() => adapter.setItem(key(owner), value));
      writes = write.catch(() => {});
      return write;
    },
  };
}
