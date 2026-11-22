import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: "date" },
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));

jest.mock("@/lib/creatine", () => ({
  getCachedCreatineLogs: jest.fn(),
  getOfflineCreatineLogs: jest.fn(),
  syncOfflineCreatineLogs: jest.fn(),
  toDateKey: jest.fn((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }),
}));

jest.mock("@/lib/offlineWeight", () => ({
  getCachedBodyWeightLogs: jest.fn(),
  getOfflineBodyWeightLogs: jest.fn(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

import NetInfo from "@react-native-community/netinfo";
import * as Notifications from "expo-notifications";
import {
  getCachedCreatineLogs,
  getOfflineCreatineLogs,
  syncOfflineCreatineLogs,
} from "../lib/creatine";
import {
  configureCreatineNotifications,
  syncCreatineReminderState,
} from "../lib/creatineNotifications";
import {
  getCachedBodyWeightLogs,
  getOfflineBodyWeightLogs,
} from "../lib/offlineWeight";
import { supabase } from "../lib/supabase";
import {
  configureWeightNotifications,
  syncWeightReminderState,
} from "../lib/weightNotifications";

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

const mockFetch = NetInfo.fetch as jest.MockedFunction<typeof NetInfo.fetch>;
const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetScheduled =
  Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const mockCancelScheduled =
  Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockSetHandler = Notifications.setNotificationHandler as jest.Mock;
const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockCreatineQuery = jest.fn();
const mockWeightQuery = jest.fn();
const mockGetOfflineCreatine = getOfflineCreatineLogs as jest.Mock;
const mockGetCachedCreatine = getCachedCreatineLogs as jest.Mock;
const mockSyncOfflineCreatine = syncOfflineCreatineLogs as jest.Mock;
const mockGetOfflineWeight = getOfflineBodyWeightLogs as jest.Mock;
const mockGetCachedWeight = getCachedBodyWeightLogs as jest.Mock;

function queryChain(result: jest.Mock) {
  const chain = {
    eq: jest.fn(),
    limit: jest.fn(),
    maybeSingle: result,
  };
  chain.eq.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

function recurringScheduleCall() {
  return mockSchedule.mock.calls.find(([request]) => request.trigger !== null)?.[0];
}

function immediateScheduleCalls() {
  return mockSchedule.mock.calls.filter(([request]) => request.trigger === null);
}

describe("reminder notification scheduling", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 22, 10, 0, 0));

    mockGetPermissions.mockResolvedValue({ granted: true });
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockGetScheduled.mockResolvedValue([]);
    mockCancelScheduled.mockResolvedValue(undefined);
    mockSchedule.mockResolvedValue("new-reminder-id");
    mockGetSession.mockResolvedValue({
      data: { user: null, session: { user: { id: "user-1" } } },
      error: null,
    });
    mockFetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);
    mockGetOfflineCreatine.mockResolvedValue([]);
    mockGetCachedCreatine.mockResolvedValue([]);
    mockSyncOfflineCreatine.mockResolvedValue({ synced: 0, remaining: 0 });
    mockGetOfflineWeight.mockResolvedValue([]);
    mockGetCachedWeight.mockResolvedValue([]);
    mockCreatineQuery.mockResolvedValue({ data: null, error: null });
    mockWeightQuery.mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "creatine_logs") {
        return { select: jest.fn(() => queryChain(mockCreatineQuery)) };
      }
      if (table === "body_weight_logs") {
        return { select: jest.fn(() => queryChain(mockWeightQuery)) };
      }
      throw new Error(`Unexpected Supabase table: ${table}`);
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("configures notification handlers for both reminder types", () => {
    configureCreatineNotifications();
    configureWeightNotifications();

    expect(mockSetHandler).toHaveBeenCalledTimes(2);
  });

  it("does nothing when notification permission is denied", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false });
    mockRequestPermissions.mockResolvedValue({ granted: false });

    await syncCreatineReminderState();
    await syncWeightReminderState();

    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("uses an offline creatine log to avoid a false immediate reminder", async () => {
    mockGetOfflineCreatine.mockResolvedValue([{ date: "2026-11-22" }]);

    await syncCreatineReminderState();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(immediateScheduleCalls()).toHaveLength(0);
    expect(recurringScheduleCall().trigger.date.getHours()).toBe(9);
    expect(recurringScheduleCall().trigger.date.getDate()).toBe(23);
  });

  it("uses cached creatine history when no pending log exists", async () => {
    mockGetCachedCreatine.mockResolvedValue([{ date: "2026-11-22" }]);

    await syncCreatineReminderState();

    expect(mockSyncOfflineCreatine).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(immediateScheduleCalls()).toHaveLength(0);
  });

  it("uses an offline weight log to avoid a false immediate reminder", async () => {
    mockGetOfflineWeight.mockResolvedValue([{ date: "2026-11-22" }]);

    await syncWeightReminderState();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(immediateScheduleCalls()).toHaveLength(0);
    expect(recurringScheduleCall().trigger.date.getHours()).toBe(7);
    expect(recurringScheduleCall().trigger.date.getDate()).toBe(23);
  });

  it("uses cached weight history when no pending log exists", async () => {
    mockGetCachedWeight.mockResolvedValue([{ date: "2026-11-22" }]);

    await syncWeightReminderState();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(immediateScheduleCalls()).toHaveLength(0);
  });

  it("schedules only one immediate creatine reminder per day", async () => {
    await syncCreatineReminderState();
    await syncCreatineReminderState();

    expect(immediateScheduleCalls()).toHaveLength(1);
    const recurring = recurringScheduleCall();
    expect(recurring.trigger.date.getHours()).toBe(21);
    expect(recurring.trigger.date.getDate()).toBe(22);
  });

  it("schedules only one immediate weight reminder per day", async () => {
    await syncWeightReminderState();
    await syncWeightReminderState();

    expect(immediateScheduleCalls()).toHaveLength(1);
    const recurring = recurringScheduleCall();
    expect(recurring.trigger.date.getHours()).toBe(20);
    expect(recurring.trigger.date.getDate()).toBe(22);
  });

  it("cancels matching stale reminders without touching unrelated ones", async () => {
    mockGetScheduled.mockResolvedValue([
      {
        identifier: "old-creatine",
        content: { data: { reminderType: "creatine-reminder" } },
      },
      {
        identifier: "unrelated",
        content: { title: "Something else", data: { screen: "home" } },
      },
    ]);

    await syncCreatineReminderState({ allowImmediate: false });

    expect(mockCancelScheduled).toHaveBeenCalledTimes(1);
    expect(mockCancelScheduled).toHaveBeenCalledWith("old-creatine");
    expect(mockCancelScheduled).not.toHaveBeenCalledWith("unrelated");
  });

  it("shares one active creatine reminder synchronization", async () => {
    const session = deferred<{
      data: { session: { user: { id: string } } };
      error: null;
    }>();
    mockGetSession.mockReturnValue(session.promise);

    const first = syncCreatineReminderState({ allowImmediate: false });
    const second = syncCreatineReminderState({ allowImmediate: false });
    session.resolve({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });
    await Promise.all([first, second]);

    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  it("shares one active weight reminder synchronization", async () => {
    const session = deferred<{
      data: { session: { user: { id: string } } };
      error: null;
    }>();
    mockGetSession.mockReturnValue(session.promise);

    const first = syncWeightReminderState({ allowImmediate: false });
    const second = syncWeightReminderState({ allowImmediate: false });
    session.resolve({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });
    await Promise.all([first, second]);

    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });
});
