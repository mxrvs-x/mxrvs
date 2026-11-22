import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@/lib/androidStepTracker", () => ({
  archiveCurrentNativeAndroidActivity: jest.fn(),
  getNativeAndroidArchivedActivities: jest.fn(),
  hasNativeAndroidStepTracker: jest.fn(() => false),
  removeNativeAndroidArchivedActivity: jest.fn(),
}));

jest.mock("@/lib/dailyActivity", () => ({
  getDailyActivitySnapshot: jest.fn(),
  refreshDailyActivity: jest.fn(),
}));

jest.mock("@/lib/offlineCardio", () => ({
  isOnline: jest.fn(),
}));

jest.mock("@/lib/offlineUser", () => ({
  resolveOfflineUserId: jest.fn(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn() },
}));

import {
  getDailyActivitySnapshot,
  refreshDailyActivity,
  type DailyActivity,
} from "../lib/dailyActivity";
import { isOnline } from "../lib/offlineCardio";
import { resolveOfflineUserId } from "../lib/offlineUser";
import {
  archiveCurrentOverallActivity,
  syncArchivedOverallActivities,
} from "../lib/overallActivity";
import { supabase } from "../lib/supabase";

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

function activity(overrides: Partial<DailyActivity> = {}): DailyActivity {
  return {
    date: "2026-11-22",
    steps: 8000,
    movingSeconds: 3600,
    distanceKm: 6,
    caloriesBurned: 420,
    weightKg: 70,
    available: true,
    permissionGranted: true,
    trackingScope: "all-day",
    updatedAt: "2026-11-22T12:00:00.000Z",
    ...overrides,
  };
}

const mockRefreshDailyActivity =
  refreshDailyActivity as jest.MockedFunction<typeof refreshDailyActivity>;
const mockGetDailyActivitySnapshot =
  getDailyActivitySnapshot as jest.MockedFunction<
    typeof getDailyActivitySnapshot
  >;
const mockIsOnline = isOnline as jest.MockedFunction<typeof isOnline>;
const mockResolveOfflineUserId =
  resolveOfflineUserId as jest.MockedFunction<typeof resolveOfflineUserId>;
const mockFrom = supabase.from as jest.Mock;
const mockLookupMaybeSingle = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();

function installSupabaseScenario() {
  const lookupChain = {
    eq: jest.fn(),
    limit: jest.fn(),
    maybeSingle: mockLookupMaybeSingle,
  };
  lookupChain.eq.mockReturnValue(lookupChain);
  lookupChain.limit.mockReturnValue(lookupChain);
  mockUpdate.mockReturnValue({ eq: mockUpdateEq });

  mockFrom.mockImplementation((table: string) => {
    if (table !== "overall_activity") {
      throw new Error(`Unexpected Supabase table: ${table}`);
    }

    return {
      select: jest.fn(() => lookupChain),
      insert: mockInsert,
      update: mockUpdate,
    };
  });
}

describe("archived overall activity synchronization", () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-11-22T12:00:00.000Z"));
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

    mockRefreshDailyActivity.mockResolvedValue(activity());
    mockGetDailyActivitySnapshot.mockReturnValue(activity());
    mockIsOnline.mockResolvedValue(false);
    mockResolveOfflineUserId.mockResolvedValue("user-1");
    mockLookupMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
    installSupabaseScenario();
  });

  afterEach(() => {
    consoleLog.mockRestore();
    jest.useRealTimers();
  });

  async function queueActivity(nextActivity = activity()) {
    mockRefreshDailyActivity.mockResolvedValueOnce(nextActivity);
    await expect(archiveCurrentOverallActivity()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
  }

  it("keeps an archived snapshot queued while offline", async () => {
    await queueActivity();

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("replaces the same date with the latest JavaScript snapshot", async () => {
    await queueActivity(activity({ steps: 4000, caloriesBurned: 200 }));
    await queueActivity(activity({ steps: 8500, caloriesBurned: 440 }));
    mockIsOnline.mockResolvedValue(true);

    await expect(syncArchivedOverallActivities()).resolves.toEqual({
      synced: 1,
      remaining: 0,
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ steps: 8500, calories_burned: 440 }),
    );
  });

  it("inserts a normalized activity row and removes the queued record", async () => {
    await queueActivity(
      activity({ steps: 8000.9, movingSeconds: 3600.8, caloriesBurned: 420.5 }),
    );
    mockIsOnline.mockResolvedValue(true);

    await expect(syncArchivedOverallActivities()).resolves.toEqual({
      synced: 1,
      remaining: 0,
    });
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      activity_date: "2026-11-22",
      steps: 8000,
      calories_burned: 420.5,
      duration_seconds: 3600,
      updated_at: "2026-11-22T12:00:00.000Z",
      created_at: "2026-11-22T12:00:00.000Z",
    });

    await expect(syncArchivedOverallActivities()).resolves.toEqual({
      synced: 0,
      remaining: 0,
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("updates an existing activity row instead of inserting a duplicate", async () => {
    await queueActivity();
    mockIsOnline.mockResolvedValue(true);
    mockLookupMaybeSingle.mockResolvedValue({
      data: { id: "overall-activity-1" },
      error: null,
    });

    await expect(syncArchivedOverallActivities()).resolves.toEqual({
      synced: 1,
      remaining: 0,
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        activity_date: "2026-11-22",
        steps: 8000,
      }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "overall-activity-1");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("retains the record when the database lookup fails", async () => {
    await queueActivity();
    mockIsOnline.mockResolvedValue(true);
    mockLookupMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "lookup failed" },
    });

    await expect(syncArchivedOverallActivities()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("retains the record when insertion fails", async () => {
    await queueActivity();
    mockIsOnline.mockResolvedValue(true);
    mockInsert.mockResolvedValue({ error: { message: "insert failed" } });

    await expect(syncArchivedOverallActivities()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
  });

  it("does not upload queued activity without a resolved user", async () => {
    await queueActivity();
    mockIsOnline.mockResolvedValue(true);
    mockResolveOfflineUserId.mockResolvedValue(null);

    await expect(syncArchivedOverallActivities()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("shares one active synchronization across concurrent callers", async () => {
    await queueActivity();
    mockIsOnline.mockResolvedValue(true);
    const upload = deferred<{ error: null }>();
    const uploadStarted = deferred<void>();
    mockInsert.mockImplementation(() => {
      uploadStarted.resolve();
      return upload.promise;
    });

    const firstSync = syncArchivedOverallActivities();
    const secondSync = syncArchivedOverallActivities();
    await uploadStarted.promise;
    upload.resolve({ error: null });

    await expect(Promise.all([firstSync, secondSync])).resolves.toEqual([
      { synced: 1, remaining: 0 },
      { synced: 1, remaining: 0 },
    ]);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("archives the current in-memory snapshot if refresh fails", async () => {
    const fallback = activity({ steps: 6200, caloriesBurned: 310 });
    mockRefreshDailyActivity.mockRejectedValue(new Error("sensor unavailable"));
    mockGetDailyActivitySnapshot.mockReturnValue(fallback);

    await expect(archiveCurrentOverallActivity()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    mockIsOnline.mockResolvedValue(true);
    await syncArchivedOverallActivities();

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ steps: 6200, calories_burned: 310 }),
    );
  });
});
