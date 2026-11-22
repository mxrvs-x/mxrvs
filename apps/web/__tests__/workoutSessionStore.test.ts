import {
  ACTIVE_WORKOUT_SESSION_KEY,
  clearStoredWorkoutSession,
  hasActiveStoredWorkoutSession,
  readStoredWorkoutSession,
  type StoredWorkoutSession,
  writeStoredWorkoutSession,
} from "../lib/workoutSessionStore";

function session(
  overrides: Partial<StoredWorkoutSession> = {},
): StoredWorkoutSession {
  return {
    selectedType: "push",
    selectedExerciseIds: ["exercise-1"],
    started: true,
    paused: false,
    elapsedSeconds: 30,
    elapsedUpdatedAt: Date.now(),
    restRemaining: 60,
    restUpdatedAt: Date.now(),
    restExerciseId: "exercise-1",
    sets: [],
    notes: "Good session",
    ...overrides,
  };
}

function installWindow() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => values.set(key, value)),
    removeItem: jest.fn((key: string) => values.delete(key)),
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  });

  return { localStorage, values };
}

describe("web workout session persistence", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-22T10:00:00.000Z"));
    Reflect.deleteProperty(globalThis, "window");
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, "window");
  });

  it("returns null during server rendering", () => {
    expect(readStoredWorkoutSession()).toBeNull();
    expect(hasActiveStoredWorkoutSession()).toBe(false);
    expect(() => clearStoredWorkoutSession()).not.toThrow();
  });

  it("returns null for missing or malformed storage", () => {
    const { values } = installWindow();
    expect(readStoredWorkoutSession()).toBeNull();

    values.set(ACTIVE_WORKOUT_SESSION_KEY, "{not-json");
    expect(readStoredWorkoutSession()).toBeNull();
  });

  it("rejects inactive sessions and unknown workout types", () => {
    const { values } = installWindow();
    values.set(
      ACTIVE_WORKOUT_SESSION_KEY,
      JSON.stringify(session({ started: false })),
    );
    expect(readStoredWorkoutSession()).toBeNull();

    values.set(
      ACTIVE_WORKOUT_SESSION_KEY,
      JSON.stringify({ ...session(), selectedType: "invalid" }),
    );
    expect(readStoredWorkoutSession()).toBeNull();
  });

  it("restores elapsed and rest timers for an active session", () => {
    const { values } = installWindow();
    const tenSecondsAgo = Date.now() - 10_000;
    values.set(
      ACTIVE_WORKOUT_SESSION_KEY,
      JSON.stringify(
        session({
          elapsedSeconds: 30,
          elapsedUpdatedAt: tenSecondsAgo,
          restRemaining: 60,
          restUpdatedAt: tenSecondsAgo,
        }),
      ),
    );

    expect(readStoredWorkoutSession()).toMatchObject({
      elapsedSeconds: 40,
      restRemaining: 50,
    });
  });

  it("does not advance timers while the session is paused", () => {
    const { values } = installWindow();
    values.set(
      ACTIVE_WORKOUT_SESSION_KEY,
      JSON.stringify(
        session({
          paused: true,
          elapsedUpdatedAt: Date.now() - 60_000,
          restUpdatedAt: Date.now() - 60_000,
        }),
      ),
    );

    expect(readStoredWorkoutSession()).toMatchObject({
      elapsedSeconds: 30,
      restRemaining: 60,
    });
  });

  it("normalizes corrupted optional and numeric fields", () => {
    const { values } = installWindow();
    values.set(
      ACTIVE_WORKOUT_SESSION_KEY,
      JSON.stringify({
        ...session(),
        selectedExerciseIds: ["exercise-1", 42, null],
        elapsedSeconds: "invalid",
        elapsedUpdatedAt: "invalid",
        restRemaining: -20,
        restUpdatedAt: Number.POSITIVE_INFINITY,
        restExerciseId: 42,
        sets: "invalid",
        notes: 42,
      }),
    );

    expect(readStoredWorkoutSession()).toEqual({
      selectedType: "push",
      selectedExerciseIds: ["exercise-1"],
      started: true,
      paused: false,
      elapsedSeconds: 0,
      elapsedUpdatedAt: 0,
      restRemaining: 0,
      restUpdatedAt: 0,
      restExerciseId: null,
      sets: [],
      notes: "",
    });
  });

  it("never applies negative timer deltas from future timestamps", () => {
    const { values } = installWindow();
    values.set(
      ACTIVE_WORKOUT_SESSION_KEY,
      JSON.stringify(
        session({
          elapsedUpdatedAt: Date.now() + 10_000,
          restUpdatedAt: Date.now() + 10_000,
        }),
      ),
    );

    expect(readStoredWorkoutSession()).toMatchObject({
      elapsedSeconds: 30,
      restRemaining: 60,
    });
  });

  it("writes, detects, and clears active sessions", () => {
    const { localStorage } = installWindow();
    const stored = session({ paused: true });

    writeStoredWorkoutSession(stored);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      ACTIVE_WORKOUT_SESSION_KEY,
      JSON.stringify(stored),
    );
    expect(hasActiveStoredWorkoutSession()).toBe(true);

    clearStoredWorkoutSession();
    expect(localStorage.removeItem).toHaveBeenCalledWith(
      ACTIVE_WORKOUT_SESSION_KEY,
    );
    expect(hasActiveStoredWorkoutSession()).toBe(false);
  });

  it("returns null when browser storage access throws", () => {
    const { localStorage } = installWindow();
    localStorage.getItem.mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(readStoredWorkoutSession()).toBeNull();
  });
});
