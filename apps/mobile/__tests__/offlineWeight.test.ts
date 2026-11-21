import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@/lib/offlineCardio", () => ({
  isOnline: jest.fn(),
  cacheOfflineBodyWeightKg: jest.fn(),
}));

jest.mock("@/lib/offlineUser", () => ({
  cacheOfflineUser: jest.fn(),
  getOfflineUserEmail: jest.fn(),
  resolveOfflineUserId: jest.fn(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(),
  },
}));

import {
  cacheOfflineBodyWeightKg,
  isOnline,
} from "../lib/offlineCardio";
import { resolveOfflineUserId } from "../lib/offlineUser";
import { supabase } from "../lib/supabase";
import {
  cacheBodyWeightLogs,
  cacheLatestBodyWeightLog,
  getCachedLatestBodyWeightLog,
  getOfflineBodyWeightLogs,
  loadBodyWeightLogs,
  loadLatestBodyWeightLog,
  logBodyWeightOffline,
  saveOfflineBodyWeightLog,
  syncOfflineBodyWeightLogs,
  type BodyWeightLogRecord,
  type OfflineBodyWeightLog,
} from "../lib/offlineWeight";

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

function offlineWeight(
  overrides: Partial<OfflineBodyWeightLog> = {},
): OfflineBodyWeightLog {
  return {
    temp_id: "offline-weight-1",
    user_id: "user-1",
    date: "2026-11-21",
    logged_at: "2026-11-21T09:00:00.000Z",
    weight_kg: 70,
    body_fat_percent: 18,
    created_at: "2026-11-21T09:00:00.000Z",
    ...overrides,
  };
}

function storedWeight(
  overrides: Partial<BodyWeightLogRecord> = {},
): BodyWeightLogRecord {
  return {
    ...offlineWeight({ temp_id: "" }),
    id: "stored-weight-1",
    offline: false,
    ...overrides,
  };
}

const mockIsOnline = isOnline as jest.MockedFunction<typeof isOnline>;
const mockCacheOfflineBodyWeightKg =
  cacheOfflineBodyWeightKg as jest.MockedFunction<
    typeof cacheOfflineBodyWeightKg
  >;
const mockResolveOfflineUserId =
  resolveOfflineUserId as jest.MockedFunction<typeof resolveOfflineUserId>;
const mockFrom = supabase.from as jest.Mock;
const mockLookupEq = jest.fn();
const mockLookupLimit = jest.fn();
const mockInsert = jest.fn();
const mockInsertSingle = jest.fn();
const mockListResult = jest.fn();
const mockLatestMaybeSingle = jest.fn();

function installSupabaseScenario() {
  const lookupChain = {
    eq: mockLookupEq,
    limit: mockLookupLimit,
  };
  mockLookupEq.mockReturnValue(lookupChain);

  const dataChain = {
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    maybeSingle: mockLatestMaybeSingle,
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => mockListResult().then(resolve, reject),
  };
  dataChain.eq.mockReturnValue(dataChain);
  dataChain.order.mockReturnValue(dataChain);
  dataChain.limit.mockReturnValue(dataChain);

  mockInsert.mockReturnValue({
    select: jest.fn(() => ({ single: mockInsertSingle })),
  });

  mockFrom.mockImplementation((table: string) => {
    if (table !== "body_weight_logs") {
      throw new Error(`Unexpected Supabase table: ${table}`);
    }

    return {
      select: jest.fn((columns: string) =>
        columns === "id" ? lookupChain : dataChain,
      ),
      insert: mockInsert,
    };
  });
}

describe("offline body-weight synchronization", () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

    mockIsOnline.mockResolvedValue(true);
    mockResolveOfflineUserId.mockResolvedValue("user-1");
    mockLookupLimit.mockResolvedValue({ data: [], error: null });
    mockInsertSingle.mockResolvedValue({
      data: storedWeight({ id: "remote-weight-1" }),
      error: null,
    });
    mockListResult.mockResolvedValue({ data: [], error: null });
    mockLatestMaybeSingle.mockResolvedValue({ data: null, error: null });
    installSupabaseScenario();
  });

  afterEach(() => {
    consoleLog.mockRestore();
    jest.useRealTimers();
  });

  it("deduplicates only the same measurement timestamp", async () => {
    await saveOfflineBodyWeightLog(offlineWeight());
    await saveOfflineBodyWeightLog(
      offlineWeight({
        temp_id: "offline-weight-2",
        logged_at: "2026-11-21T18:00:00.000Z",
        created_at: "2026-11-21T18:00:00.000Z",
      }),
    );
    await saveOfflineBodyWeightLog(
      offlineWeight({
        temp_id: "offline-weight-newest",
        logged_at: "2026-11-21T18:00:00.000Z",
        created_at: "2026-11-21T18:01:00.000Z",
      }),
    );

    const pending = await getOfflineBodyWeightLogs();
    expect(pending).toHaveLength(2);
    expect(pending.map((log) => log.temp_id)).toEqual([
      "offline-weight-newest",
      "offline-weight-1",
    ]);
  });

  it("keeps queued entries and reports their count while offline", async () => {
    await saveOfflineBodyWeightLog(offlineWeight());
    mockIsOnline.mockResolvedValue(false);

    await expect(syncOfflineBodyWeightLogs()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    expect(await getOfflineBodyWeightLogs()).toHaveLength(1);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("uploads a measurement, removes it, and refreshes the widget cache", async () => {
    const pending = offlineWeight();
    await saveOfflineBodyWeightLog(pending);

    await expect(syncOfflineBodyWeightLogs()).resolves.toEqual({
      synced: 1,
      remaining: 0,
    });
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: pending.user_id,
      date: pending.date,
      logged_at: pending.logged_at,
      weight_kg: pending.weight_kg,
      body_fat_percent: pending.body_fat_percent,
      created_at: pending.created_at,
    });
    expect(await getOfflineBodyWeightLogs()).toEqual([]);
    expect(mockCacheOfflineBodyWeightKg).toHaveBeenCalledWith(70);
  });

  it("checks duplicate identity by logged_at instead of calendar date", async () => {
    const pending = offlineWeight();
    await saveOfflineBodyWeightLog(pending);
    mockLookupLimit.mockResolvedValue({
      data: [{ id: "existing-weight" }],
      error: null,
    });

    await syncOfflineBodyWeightLogs();

    expect(mockLookupEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockLookupEq).toHaveBeenCalledWith(
      "logged_at",
      pending.logged_at,
    );
    expect(mockLookupEq).not.toHaveBeenCalledWith("date", pending.date);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(await getOfflineBodyWeightLogs()).toEqual([]);
  });

  it("keeps a measurement queued when its upload fails", async () => {
    await saveOfflineBodyWeightLog(offlineWeight());
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { message: "failed" },
    });

    await expect(syncOfflineBodyWeightLogs()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    expect(await getOfflineBodyWeightLogs()).toHaveLength(1);
  });

  it("shares one active synchronization across concurrent callers", async () => {
    await saveOfflineBodyWeightLog(offlineWeight());
    const upload = deferred<{
      data: BodyWeightLogRecord;
      error: null;
    }>();
    const uploadStarted = deferred<void>();
    mockInsertSingle.mockImplementation(() => {
      uploadStarted.resolve();
      return upload.promise;
    });

    const firstSync = syncOfflineBodyWeightLogs();
    const secondSync = syncOfflineBodyWeightLogs();
    await uploadStarted.promise;
    upload.resolve({ data: storedWeight(), error: null });

    await expect(Promise.all([firstSync, secondSync])).resolves.toEqual([
      { synced: 1, remaining: 0 },
      { synced: 1, remaining: 0 },
    ]);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("keeps cached history visible when the online request fails", async () => {
    const cached = storedWeight();
    await cacheBodyWeightLogs([cached]);
    mockListResult.mockResolvedValue({
      data: null,
      error: { message: "temporary failure" },
    });

    await expect(loadBodyWeightLogs()).resolves.toEqual([cached]);
  });

  it("preserves multiple same-day measurements in offline history", async () => {
    const morning = storedWeight();
    const evening = offlineWeight({
      temp_id: "offline-evening",
      logged_at: "2026-11-21T18:00:00.000Z",
      created_at: "2026-11-21T18:00:00.000Z",
      weight_kg: 69.5,
    });
    await cacheBodyWeightLogs([morning]);
    await saveOfflineBodyWeightLog(evening);
    mockIsOnline.mockResolvedValue(false);

    const logs = await loadBodyWeightLogs();
    expect(logs).toHaveLength(2);
    expect(logs.map((log) => log.logged_at)).toEqual([
      evening.logged_at,
      morning.logged_at,
    ]);
  });

  it("creates and caches a deterministic offline measurement", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-21T10:00:00.000Z"));

    const created = await logBodyWeightOffline({
      date: "2026-11-21",
      logged_at: "2026-11-21T10:00:00.000Z",
      weight_kg: 70,
      body_fat_percent: 18,
    });

    expect(created).toMatchObject({
      temp_id: `offline_weight_2026-11-21_${Date.now()}`,
      id: `offline_weight_2026-11-21_${Date.now()}`,
      user_id: "user-1",
      offline: true,
    });
    expect(await getCachedLatestBodyWeightLog()).toMatchObject({
      weight_kg: 70,
    });
    expect(mockCacheOfflineBodyWeightKg).toHaveBeenCalledWith(70);
  });

  it("returns the cached latest measurement without network access", async () => {
    const cached = storedWeight();
    await cacheLatestBodyWeightLog(cached);
    jest.clearAllMocks();
    mockIsOnline.mockResolvedValue(false);

    await expect(loadLatestBodyWeightLog()).resolves.toEqual(cached);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
