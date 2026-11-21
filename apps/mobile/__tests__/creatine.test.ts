import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

import { supabase } from "../lib/supabase";
import {
  cacheCreatineLogs,
  deleteCreatineLog,
  getOfflineCreatineLogs,
  loadCreatineLogs,
  logCreatineForDate,
  saveOfflineCreatineLog,
  syncOfflineCreatineLogs,
  type CreatineLog,
  type OfflineCreatineLog,
} from "../lib/creatine";

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

function offlineLog(
  overrides: Partial<OfflineCreatineLog> = {},
): OfflineCreatineLog {
  return {
    temp_id: "offline-creatine-1",
    user_id: "user-1",
    date: "2026-11-21",
    logged_at: "2026-11-21T09:00:00.000Z",
    grams: 5,
    notes: null,
    ...overrides,
  };
}

function cachedLog(overrides: Partial<CreatineLog> = {}): CreatineLog {
  return {
    id: "cached-creatine-1",
    user_id: "user-1",
    date: "2026-11-20",
    logged_at: "2026-11-20T09:00:00.000Z",
    grams: 5,
    notes: null,
    ...overrides,
  };
}

const mockNetInfoFetch = NetInfo.fetch as jest.MockedFunction<
  typeof NetInfo.fetch
>;
const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockMaybeSingle = jest.fn();
const mockUpsert = jest.fn();
const mockUpsertResult = jest.fn();
const mockUpsertSingle = jest.fn();
const mockLoadResult = jest.fn();
const mockDelete = jest.fn();
const mockDeleteResult = jest.fn();

function installSupabaseScenario() {
  const lookupChain = {
    eq: jest.fn(),
    maybeSingle: mockMaybeSingle,
  };
  lookupChain.eq.mockReturnValue(lookupChain);

  let loadOrderCalls = 0;
  const loadChain = {
    eq: jest.fn(),
    order: jest.fn(),
  };
  loadChain.eq.mockReturnValue(loadChain);
  loadChain.order.mockImplementation(() => {
    loadOrderCalls += 1;
    return loadOrderCalls % 2 === 1 ? loadChain : mockLoadResult();
  });

  const select = jest.fn((columns: string) =>
    columns === "id" ? lookupChain : loadChain,
  );

  mockUpsert.mockImplementation(() => {
    const operation = mockUpsertResult() as Promise<{ error: unknown }> & {
      select?: (columns: string) => { single: typeof mockUpsertSingle };
    };
    operation.select = () => ({ single: mockUpsertSingle });
    return operation;
  });

  let deleteEqCalls = 0;
  const deleteChain = {
    eq: jest.fn(),
  };
  deleteChain.eq.mockImplementation(() => {
    deleteEqCalls += 1;
    return deleteEqCalls % 2 === 1 ? deleteChain : mockDeleteResult();
  });
  mockDelete.mockReturnValue(deleteChain);

  mockFrom.mockImplementation((table: string) => {
    if (table !== "creatine_logs") {
      throw new Error(`Unexpected Supabase table: ${table}`);
    }

    return {
      select,
      upsert: mockUpsert,
      delete: mockDelete,
    };
  });
}

describe("creatine offline synchronization", () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

    mockNetInfoFetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsertResult.mockResolvedValue({ error: null });
    mockUpsertSingle.mockResolvedValue({
      data: cachedLog({ id: "remote-creatine-1", date: "2026-11-21" }),
      error: null,
    });
    mockLoadResult.mockResolvedValue({ data: [], error: null });
    mockDeleteResult.mockResolvedValue({ error: null });
    installSupabaseScenario();
  });

  afterEach(() => {
    consoleLog.mockRestore();
    jest.useRealTimers();
  });

  it("replaces an older pending entry for the same date", async () => {
    await saveOfflineCreatineLog(offlineLog());
    await saveOfflineCreatineLog(
      offlineLog({
        temp_id: "offline-creatine-newer",
        logged_at: "2026-11-21T10:00:00.000Z",
        notes: "Updated",
      }),
    );

    const pending = await getOfflineCreatineLogs();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      temp_id: "offline-creatine-newer",
      notes: "Updated",
    });
  });

  it("keeps queued entries and reports their count while offline", async () => {
    await saveOfflineCreatineLog(offlineLog());
    mockNetInfoFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    await expect(syncOfflineCreatineLogs()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    expect(await getOfflineCreatineLogs()).toHaveLength(1);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("uploads and removes a queued entry after success", async () => {
    const pending = offlineLog();
    await saveOfflineCreatineLog(pending);

    await expect(syncOfflineCreatineLogs()).resolves.toEqual({
      synced: 1,
      remaining: 0,
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: pending.user_id,
        date: pending.date,
        logged_at: pending.logged_at,
        grams: pending.grams,
        notes: pending.notes,
      },
      { onConflict: "user_id,date" },
    );
    expect(await getOfflineCreatineLogs()).toEqual([]);
  });

  it("keeps a queued entry when upload fails", async () => {
    await saveOfflineCreatineLog(offlineLog());
    mockUpsertResult.mockResolvedValue({ error: { message: "failed" } });

    await expect(syncOfflineCreatineLogs()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    expect(await getOfflineCreatineLogs()).toHaveLength(1);
  });

  it("uses the existing server record without another upsert", async () => {
    await saveOfflineCreatineLog(offlineLog());
    mockMaybeSingle.mockResolvedValue({
      data: { id: "remote-creatine-1" },
      error: null,
    });

    await expect(syncOfflineCreatineLogs()).resolves.toEqual({
      synced: 0,
      remaining: 0,
    });
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(await getOfflineCreatineLogs()).toEqual([]);
  });

  it("shares one active synchronization across concurrent callers", async () => {
    await saveOfflineCreatineLog(offlineLog());
    const upload = deferred<{ error: null }>();
    const uploadStarted = deferred<void>();
    mockUpsertResult.mockImplementation(() => {
      uploadStarted.resolve();
      return upload.promise;
    });

    const firstSync = syncOfflineCreatineLogs();
    const secondSync = syncOfflineCreatineLogs();
    await uploadStarted.promise;
    upload.resolve({ error: null });

    await expect(Promise.all([firstSync, secondSync])).resolves.toEqual([
      { synced: 1, remaining: 0 },
      { synced: 1, remaining: 0 },
    ]);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("returns cached history when the online history request fails", async () => {
    const cached = cachedLog();
    await cacheCreatineLogs([cached]);
    mockLoadResult.mockResolvedValue({
      data: null,
      error: { message: "temporary failure" },
    });

    await expect(loadCreatineLogs()).resolves.toEqual([cached]);
  });

  it("stores a deterministic pending entry when logging offline", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-21T10:00:00.000Z"));
    mockNetInfoFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    const created = await logCreatineForDate({
      date: "2026-11-21",
      grams: 5,
      notes: "Daily dose",
    });

    expect(created).toMatchObject({
      id: `offline_creatine_2026-11-21_${Date.now()}`,
      user_id: "user-1",
      offline: true,
      logged_at: "2026-11-21T10:00:00.000Z",
    });
    expect(await getOfflineCreatineLogs()).toHaveLength(1);
  });

  it("deletes an offline entry without contacting Supabase", async () => {
    const pending = offlineLog();
    await saveOfflineCreatineLog(pending);

    await deleteCreatineLog({
      ...pending,
      id: pending.temp_id,
      offline: true,
    });

    expect(await getOfflineCreatineLogs()).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("deletes a synchronized entry by user and date", async () => {
    const log = cachedLog();

    await deleteCreatineLog(log);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    const deleteChain = mockDelete.mock.results[0].value as {
      eq: jest.Mock;
    };
    expect(deleteChain.eq).toHaveBeenNthCalledWith(1, "user_id", "user-1");
    expect(deleteChain.eq).toHaveBeenNthCalledWith(2, "date", log.date);
  });
});
