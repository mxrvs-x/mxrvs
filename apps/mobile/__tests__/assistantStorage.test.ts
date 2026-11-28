import { CHAT_STARTERS, createAssistantStorage } from "../lib/assistantChat";

function localStorage() {
  const records = new Map<string, string>();
  return {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { records.set(key, value); },
  };
}

it("restores the latest conversation for its account on a new launch", async () => {
  const device = localStorage();
  const chat = { starters: 1, messages: [
    { role: "user" as const, content: "What did I log?" },
    { role: "assistant" as const, content: "You logged a walk." },
  ] };
  await createAssistantStorage(device).save("owner", chat);

  const reopened = createAssistantStorage(device);
  await expect(reopened.load("owner")).resolves.toEqual(chat);
  await expect(reopened.load("another-account")).resolves.toEqual({ starters: 0, messages: [] });
});

it("lets clearing win over earlier queued writes and saves the next starter set", async () => {
  const storage = createAssistantStorage(localStorage());
  const initial = { starters: 0, messages: [{ role: "user" as const, content: "Old question" }] };
  const cleared = { starters: 1, messages: [] };
  const pending = storage.save("owner", initial);
  const reset = storage.save("owner", cleared);
  await Promise.all([pending, reset]);

  await expect(storage.load("owner")).resolves.toEqual(cleared);
  expect(CHAT_STARTERS[1].some((starter) => CHAT_STARTERS[0].includes(starter))).toBe(false);
});
