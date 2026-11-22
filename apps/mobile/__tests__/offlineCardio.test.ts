import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

import NetInfo from "@react-native-community/netinfo";
import { supabase } from "../lib/supabase";
import {
  cacheCardioSessions,
  getCachedCardioSessions,
  getOfflineCardioSessions,
  mergeCardioSessions,
  saveOfflineCardioSession,
  syncOfflineCardioSessions,
  type CachedCardioSession,
  type OfflineCardioSession,
} from "../lib/offlineCardio";

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

function offlineSession(
  overrides: Partial<OfflineCardioSession> = {},
): OfflineCardioSession {
  return {
    temp_id: "offline-cardio-1",
    user_id: "user-1",
    session_date: "2026-11-21",
    cardio_type: "running",
    cardio_source: "outdoor",
    distance_km: 5,
    duration_seconds: 1800,
    steps: 6000,
    calories_burned: 350,
    avg_heart_rate: 145,
    notes: "Morning run",
    route: null,
    is_mock: false,
    created_at: "2026-11-21T06:00:00.000Z",
    ...overrides,
  };
}

function cachedSession(
  overrides: Partial<CachedCardioSession> = {},
): CachedCardioSession {
  const { temp_id: _tempId, ...session } = offlineSession();
  return { ...session, id: "cardio-1", ...overrides };
}

const mockFetch = NetInfo.fetch as jest.MockedFunction<typeof NetInfo.fetch>;
const mockFrom = supabase.from as jest.Mock;
const mockLookupEq = jest.fn();
const mockLookupLimit = jest.fn();
const mockInsert = jest.fn();

function installSupabaseScenario() {
  const lookupChain = {
    eq: mockLookupEq,
    limit: mockLookupLimit,
  };
  mockLookupEq.mockReturnValue(lookupChain);

  mockFrom.mockImplementation((table: string) => {
    if (table !== "cardio_sessions") {
      throw new Error(`Unexpected Supabase table: ${table}`);
    }

    return {
      select: jest.fn(() => lookupChain),
      insert: mockInsert,
    };
  });
}

describe("offline cardio synchronization", () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

    mockFetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);
    mockLookupLimit.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ error: null });
    installSupabaseScenario();
  });

  afterEach(() => {
    consoleLog.mockRestore();
  });

  it("preserves separate sessions recorded on the same day", async () => {
    await saveOfflineCardioSession(offlineSession());
    await saveOfflineCardioSession(
      offlineSession({
        temp_id: "offline-cardio-2",
        created_at: "2026-11-21T18:00:00.000Z",
      }),
    );
    await saveOfflineCardioSession(
      offlineSession({
        temp_id: "offline-cardio-newest",
        created_at: "2026-11-21T18:00:00.000Z",
      }),
    );

    const pending = await getOfflineCardioSessions();
    expect(pending).toHaveLength(2);
    expect(pending.map((session) => session.temp_id)).toEqual([
      "offline-cardio-newest",
      "offline-cardio-1",
    ]);
  });

  it("keeps queued sessions and reports their count while offline", async () => {
    await saveOfflineCardioSession(offlineSession());
    mockFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    await expect(syncOfflineCardioSessions()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    expect(await getOfflineCardioSessions()).toHaveLength(1);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("uploads a session before removing it from the queue", async () => {
    const pending = offlineSession();
    await saveOfflineCardioSession(pending);

    await expect(syncOfflineCardioSessions()).resolves.toEqual({
      synced: 1,
      remaining: 0,
    });
    const { temp_id: _tempId, ...payload } = pending;
    expect(mockInsert).toHaveBeenCalledWith(payload);
    expect(await getOfflineCardioSessions()).toEqual([]);
  });

  it("checks remote duplicate identity by created_at", async () => {
    const pending = offlineSession();
    await saveOfflineCardioSession(pending);
    mockLookupLimit.mockResolvedValue({
      data: [{ id: "existing-cardio" }],
      error: null,
    });

    await syncOfflineCardioSessions();

    expect(mockLookupEq).toHaveBeenCalledWith("user_id", pending.user_id);
    expect(mockLookupEq).toHaveBeenCalledWith("created_at", pending.created_at);
    expect(mockLookupEq).not.toHaveBeenCalledWith(
      "session_date",
      pending.session_date,
    );
    expect(mockInsert).not.toHaveBeenCalled();
    expect(await getOfflineCardioSessions()).toEqual([]);
  });

  it("keeps a session queued when its upload fails", async () => {
    await saveOfflineCardioSession(offlineSession());
    mockInsert.mockResolvedValue({ error: { message: "failed" } });

    await expect(syncOfflineCardioSessions()).resolves.toEqual({
      synced: 0,
      remaining: 1,
    });
    expect(await getOfflineCardioSessions()).toHaveLength(1);
  });

  it("shares one active synchronization across concurrent callers", async () => {
    await saveOfflineCardioSession(offlineSession());
    const upload = deferred<{ error: null }>();
    const uploadStarted = deferred<void>();
    mockInsert.mockImplementation(() => {
      uploadStarted.resolve();
      return upload.promise;
    });

    const firstSync = syncOfflineCardioSessions();
    const secondSync = syncOfflineCardioSessions();
    await uploadStarted.promise;
    upload.resolve({ error: null });

    await expect(Promise.all([firstSync, secondSync])).resolves.toEqual([
      { synced: 1, remaining: 0 },
      { synced: 1, remaining: 0 },
    ]);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("merges cached and offline history without hiding same-day sessions", () => {
    const cached = cachedSession();
    const evening = {
      ...offlineSession({
        temp_id: "offline-evening",
        created_at: "2026-11-21T18:00:00.000Z",
      }),
      id: "offline-evening",
      offline: true,
    };

    const merged = mergeCardioSessions([evening], [cached]);
    expect(merged).toHaveLength(2);
    expect(merged.map((session) => session.created_at)).toEqual([
      evening.created_at,
      cached.created_at,
    ]);
  });

  it("prefers the pending session over an exact cached duplicate", () => {
    const pending = {
      ...offlineSession(),
      id: "offline-cardio-1",
      offline: true,
    };
    const cached = cachedSession({ created_at: pending.created_at });

    expect(mergeCardioSessions([pending], [cached])).toEqual([pending]);
  });

  it("restores cached cardio history without network access", async () => {
    const cached = [
      cachedSession(),
      cachedSession({
        id: "cardio-2",
        created_at: "2026-11-20T18:00:00.000Z",
        session_date: "2026-11-20",
      }),
    ];
    await cacheCardioSessions(cached);
    jest.clearAllMocks();

    await expect(getCachedCardioSessions()).resolves.toEqual(cached);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
