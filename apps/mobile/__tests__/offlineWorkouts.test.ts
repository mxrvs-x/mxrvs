import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@/lib/offlineCardio", () => ({
  isOnline: jest.fn(),
}));

jest.mock("@/lib/offlineUser", () => ({
  getOfflineUserId: jest.fn(),
  resolveOfflineUserId: jest.fn(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { isOnline } from "../lib/offlineCardio";
import { getOfflineUserId, resolveOfflineUserId } from "../lib/offlineUser";
import { supabase } from "../lib/supabase";

import {
  createOfflineWorkout,
  getOfflineWorkouts,
  saveOfflineWorkout,
  syncOfflineWorkouts,
  type OfflineWorkout,
} from "../lib/offlineWorkouts";

const mockIsOnline = isOnline as jest.MockedFunction<typeof isOnline>;
const mockResolveOfflineUserId =
  resolveOfflineUserId as jest.MockedFunction<typeof resolveOfflineUserId>;
const mockGetOfflineUserId =
  getOfflineUserId as jest.MockedFunction<typeof getOfflineUserId>;
const mockFrom = supabase.from as jest.Mock;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function workout(overrides: Partial<OfflineWorkout> = {}): OfflineWorkout {
  return {
    temp_id: "offline-workout-1",
    user_id: "user-1",
    workout_date: "2026-11-21",
    workout_type: "push",
    notes: "Good session",
    duration_minutes: 45,
    created_at: "2026-11-21T10:00:00.000Z",
    sets: [
      {
        exercise_id: "exercise-1",
        exercise_name: "Bench Press",
        set_number: 1,
        reps: 8,
        weight_kg: 60,
        rest_seconds: 90,
      },
    ],
    ...overrides,
  };
}

const mockLookupLimit = jest.fn();
const mockWorkoutInsert = jest.fn();
const mockWorkoutSingle = jest.fn();
const mockSetInsert = jest.fn();
const mockWorkoutDelete = jest.fn();
const mockWorkoutDeleteEq = jest.fn();

function installSupabaseScenario() {
  const lookupChain = {
    eq: jest.fn(),
    limit: mockLookupLimit,
  };
  lookupChain.eq.mockReturnValue(lookupChain);

  const insertedWorkoutChain = {
    select: jest.fn(() => ({ single: mockWorkoutSingle })),
  };

  mockWorkoutInsert.mockReturnValue(insertedWorkoutChain);
  mockWorkoutDelete.mockReturnValue({ eq: mockWorkoutDeleteEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === "workouts") {
      return {
        select: jest.fn(() => lookupChain),
        insert: mockWorkoutInsert,
        delete: mockWorkoutDelete,
      };
    }

    if (table === "workout_sets") {
      return { insert: mockSetInsert };
    }

    throw new Error(`Unexpected Supabase table: ${table}`);
  });
}

describe("offline workout synchronization", () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

    mockIsOnline.mockResolvedValue(true);
    mockResolveOfflineUserId.mockResolvedValue("user-1");
    mockGetOfflineUserId.mockResolvedValue("user-1");
    mockLookupLimit.mockResolvedValue({ data: [], error: null });
    mockWorkoutSingle.mockResolvedValue({
      data: { id: "remote-workout-1" },
      error: null,
    });
    mockSetInsert.mockResolvedValue({ error: null });
    mockWorkoutDeleteEq.mockResolvedValue({ error: null });
    installSupabaseScenario();
  });

  afterEach(() => {
    consoleLog.mockRestore();
    jest.useRealTimers();
  });

  it("keeps queued workouts untouched while offline", async () => {
    await saveOfflineWorkout(workout());
    mockIsOnline.mockResolvedValue(false);

    await expect(syncOfflineWorkouts()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    expect(await getOfflineWorkouts()).toHaveLength(1);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("exposes only the active user's queued workouts", async () => {
    await saveOfflineWorkout(workout({ temp_id: "user-1-workout" }));
    await saveOfflineWorkout(
      workout({ temp_id: "user-2-workout", user_id: "user-2" }),
    );

    await expect(getOfflineWorkouts()).resolves.toEqual([
      expect.objectContaining({ temp_id: "user-1-workout" }),
    ]);
    mockGetOfflineUserId.mockResolvedValue("user-2");
    await expect(getOfflineWorkouts()).resolves.toEqual([
      expect.objectContaining({ temp_id: "user-2-workout" }),
    ]);
  });

  it("uploads a workout and its sets before removing the queue entry", async () => {
    const pending = workout();
    await saveOfflineWorkout(pending);

    await expect(syncOfflineWorkouts()).resolves.toEqual({
      synced: 1,
      remaining: 0,
    });

    expect(mockWorkoutInsert).toHaveBeenCalledWith({
      user_id: pending.user_id,
      workout_date: pending.workout_date,
      workout_type: pending.workout_type,
      notes: pending.notes,
      duration_minutes: pending.duration_minutes,
      created_at: pending.created_at,
    });
    expect(mockSetInsert).toHaveBeenCalledWith([
      {
        user_id: pending.user_id,
        workout_id: "remote-workout-1",
        exercise_id: "exercise-1",
        set_number: 1,
        reps: 8,
        weight_kg: 60,
        rest_seconds: 90,
      },
    ]);
    expect(await getOfflineWorkouts()).toEqual([]);
  });

  it("syncs recovery check-in scores with an offline workout", async () => {
    const pending = workout({
      recovery_energy: 4,
      recovery_sleep_quality: 3,
      recovery_soreness: 2,
      recovery_motivation: 5,
      recovery_stress: 1,
    });
    await saveOfflineWorkout(pending);

    await syncOfflineWorkouts();

    expect(mockWorkoutInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        recovery_energy: 4,
        recovery_sleep_quality: 3,
        recovery_soreness: 2,
        recovery_motivation: 5,
        recovery_stress: 1,
      }),
    );
  });

  it("keeps the complete workout queued when its parent insert fails", async () => {
    await saveOfflineWorkout(workout());
    mockWorkoutSingle.mockResolvedValue({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(syncOfflineWorkouts()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    expect(mockSetInsert).not.toHaveBeenCalled();
    expect(await getOfflineWorkouts()).toHaveLength(1);
  });

  it("rolls back the parent and keeps the queue entry when sets fail", async () => {
    await saveOfflineWorkout(workout());
    mockSetInsert.mockResolvedValue({ error: { message: "sets failed" } });

    await expect(syncOfflineWorkouts()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    expect(mockWorkoutDelete).toHaveBeenCalledTimes(1);
    expect(mockWorkoutDeleteEq).toHaveBeenCalledWith(
      "id",
      "remote-workout-1",
    );
    expect(await getOfflineWorkouts()).toHaveLength(1);
  });

  it("resolves an already-existing remote workout without reinserting", async () => {
    await saveOfflineWorkout(workout());
    mockLookupLimit.mockResolvedValue({
      data: [{ id: "existing-workout" }],
      error: null,
    });

    await expect(syncOfflineWorkouts()).resolves.toEqual({
      synced: 0,
      remaining: 0,
    });
    expect(mockWorkoutInsert).not.toHaveBeenCalled();
    expect(mockSetInsert).not.toHaveBeenCalled();
    expect(await getOfflineWorkouts()).toEqual([]);
  });

  it("deduplicates equivalent pending workouts", async () => {
    await saveOfflineWorkout(workout());
    await saveOfflineWorkout(
      workout({
        temp_id: "offline-workout-newer",
        created_at: "2026-11-21T10:01:00.000Z",
      }),
    );

    const pending = await getOfflineWorkouts();
    expect(pending).toHaveLength(1);
    expect(pending[0].temp_id).toBe("offline-workout-newer");
  });

  it("shares one active synchronization across concurrent callers", async () => {
    await saveOfflineWorkout(workout());
    const insertResult = deferred<{
      data: { id: string };
      error: null;
    }>();
    const insertStarted = deferred<void>();

    mockWorkoutSingle.mockImplementation(() => {
      insertStarted.resolve();
      return insertResult.promise;
    });

    const firstSync = syncOfflineWorkouts();
    const secondSync = syncOfflineWorkouts();
    await insertStarted.promise;
    insertResult.resolve({ data: { id: "remote-workout-1" }, error: null });

    await expect(Promise.all([firstSync, secondSync])).resolves.toEqual([
      { synced: 1, remaining: 0 },
      { synced: 1, remaining: 0 },
    ]);
    expect(mockWorkoutInsert).toHaveBeenCalledTimes(1);
    expect(mockSetInsert).toHaveBeenCalledTimes(1);
  });

  it("preserves a new workout added while synchronization is running", async () => {
    await saveOfflineWorkout(workout());
    const insertResult = deferred<{
      data: { id: string };
      error: null;
    }>();
    const insertStarted = deferred<void>();

    mockWorkoutSingle.mockImplementation(() => {
      insertStarted.resolve();
      return insertResult.promise;
    });

    const syncing = syncOfflineWorkouts();
    await insertStarted.promise;
    await saveOfflineWorkout(
      workout({
        temp_id: "offline-workout-2",
        workout_date: "2026-11-22",
        created_at: "2026-11-22T10:00:00.000Z",
      }),
    );
    insertResult.resolve({ data: { id: "remote-workout-1" }, error: null });

    await expect(syncing).resolves.toEqual({ synced: 1, remaining: 1 });
    expect((await getOfflineWorkouts()).map((item) => item.temp_id)).toEqual([
      "offline-workout-2",
    ]);
  });

  it("creates a deterministic offline record for a cached user", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-21T10:00:00.000Z"));

    const created = await createOfflineWorkout({
      workout_date: "2026-11-21",
      workout_type: "push",
      notes: null,
      duration_minutes: 30,
      recovery: {
        recovery_energy: 4,
        recovery_sleep_quality: 3,
        recovery_soreness: 2,
        recovery_motivation: 5,
        recovery_stress: 2,
      },
      sets: workout().sets,
    });

    expect(created).toMatchObject({
      temp_id: `offline_workout_2026-11-21_${Date.now()}`,
      user_id: "user-1",
      created_at: "2026-11-21T10:00:00.000Z",
      recovery_energy: 4,
      recovery_sleep_quality: 3,
      recovery_soreness: 2,
      recovery_motivation: 5,
      recovery_stress: 2,
    });
    expect(await getOfflineWorkouts()).toEqual([created]);
  });
});
