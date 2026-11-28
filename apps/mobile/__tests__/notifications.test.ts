import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Notifications from "expo-notifications";
import { getCachedCreatineLogs, getOfflineCreatineLogs } from "@/lib/creatine";
import { getCachedBodyWeightLogs, getOfflineBodyWeightLogs } from "@/lib/offlineWeight";
import { supabase } from "@/lib/supabase";
import {
  configureLogReminders, getLastLogReminderUser, recordReminderLogChange, refreshLogReminders, setLogReminderUser,
} from "@/lib/logReminders";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@react-native-community/netinfo", () => ({ __esModule: true, default: { fetch: jest.fn() } }));
jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: "date", DAILY: "daily" },
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));
jest.mock("@/lib/creatine", () => ({
  getCachedCreatineLogs: jest.fn(),
  getOfflineCreatineLogs: jest.fn(),
}));
jest.mock("@/lib/offlineWeight", () => ({
  getCachedBodyWeightLogs: jest.fn(),
  getOfflineBodyWeightLogs: jest.fn(),
}));
jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));

const fetchNetwork = NetInfo.fetch as jest.Mock;
const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const pending = new Map<string, Notifications.NotificationRequestInput>();
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const from = supabase.from as jest.Mock;
const remoteRows: Record<string, { date?: string; log_date?: string }[]> = {};
const today = "2026-11-22";

function todayHours(kind: string) {
  return [...pending.values()].flatMap(({ content, trigger }) => {
    if (
      content.data?.reminderType !== kind + "-reminder" || !trigger || typeof trigger !== "object" ||
      !("date" in trigger) || !(trigger.date instanceof Date) || trigger.date.getDate() !== 22
    ) return [];
    return [trigger.date.getHours()];
  });
}

function goOnline(online: boolean) {
  fetchNetwork.mockResolvedValue({ isConnected: online, isInternetReachable: online });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 22, 6));
  pending.clear();
  Object.keys(remoteRows).forEach((key) => delete remoteRows[key]);
  goOnline(false);
  getPermissions.mockResolvedValue({ granted: true });
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockImplementation(async () => [...pending.values()]);
  schedule.mockImplementation(async (request: Notifications.NotificationRequestInput) => {
    pending.set(request.identifier!, request);
    return request.identifier;
  });
  cancel.mockImplementation(async (identifier: string) => { pending.delete(identifier); });
  for (const cache of [getOfflineBodyWeightLogs, getCachedBodyWeightLogs, getOfflineCreatineLogs, getCachedCreatineLogs]) {
    (cache as jest.Mock).mockResolvedValue([]);
  }
  from.mockImplementation((table: string) => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      abortSignal: async () => ({ data: remoteRows[table] ?? [], error: null }),
    };
    return query;
  });
  await setLogReminderUser(null);
  jest.clearAllMocks();
});

afterEach(() => jest.useRealTimers());

test("configures foreground delivery and schedules the requested local hours while offline", async () => {
  configureLogReminders();
  await setLogReminderUser("user-1");

  expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
  expect(from).not.toHaveBeenCalled();
  expect(todayHours("sleep")).toEqual([9, 21]);
  expect(todayHours("weight")).toEqual([7, 20]);
  expect(todayHours("creatine")).toEqual([9, 21]);
  expect([...pending.values()].find(({ content }) => content.data?.screen === "macros")?.trigger)
    .toMatchObject({ type: "daily", hour: 21, minute: 0 });
  expect(pending.size).toBe(43);
});

test("reconnection preserves pending alarms without replaying delivered or missed reminders", async () => {
  await setLogReminderUser("user-1");
  const seven = new Date(2026, 10, 22, 7).getTime();
  const nine = new Date(2026, 10, 22, 9).getTime();
  pending.delete("mxrvs:user-1:weight:" + seven);
  pending.delete("mxrvs:user-1:sleep:" + nine);
  // Creatine's 9 AM alarm remains pending if Android is deferring delivery.
  jest.setSystemTime(new Date(2026, 10, 22, 10));
  schedule.mockClear();
  cancel.mockClear();

  goOnline(true);
  await Promise.all([refreshLogReminders(), refreshLogReminders()]);

  expect(schedule).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
  expect(todayHours("weight")).toEqual([20]);
  expect(todayHours("sleep")).toEqual([21]);
  expect(todayHours("creatine")).toEqual([9, 21]);
});

test("today's sleep save cancels the second reminder offline and deletion restores the future slot", async () => {
  await setLogReminderUser("user-1");
  const nine = new Date(2026, 10, 22, 9).getTime();
  pending.delete("mxrvs:user-1:sleep:" + nine);
  jest.setSystemTime(new Date(2026, 10, 22, 10));
  await recordReminderLogChange("user-1", "sleep", { added: today });
  expect(todayHours("sleep")).toEqual([]);
  expect([...pending.values()].some(({ content }) => content.data?.screen === "macros")).toBe(true);

  await recordReminderLogChange("user-1", "sleep", { removed: today });
  expect(todayHours("sleep")).toEqual([21]);
});

test("remote logs stay known offline and pending writes suppress same-day weight and creatine reminders", async () => {
  goOnline(true);
  remoteRows.sleep_logs = [{ log_date: today }];
  await setLogReminderUser("user-1");
  expect(todayHours("sleep")).toEqual([]);

  goOnline(false);
  (getOfflineBodyWeightLogs as jest.Mock).mockResolvedValue([{ user_id: "user-1", date: today }]);
  (getOfflineCreatineLogs as jest.Mock).mockResolvedValue([{ user_id: "user-1", date: today }]);
  await refreshLogReminders();
  expect(todayHours("sleep")).toEqual([]);
  expect(todayHours("weight")).toEqual([]);
  expect(todayHours("creatine")).toEqual([]);

  // An unrelated account's cached entry cannot suppress this account's reminders.
  (getOfflineCreatineLogs as jest.Mock).mockResolvedValue([]);
  (getCachedCreatineLogs as jest.Mock).mockResolvedValue([{ user_id: "user-2", date: today }]);
  await refreshLogReminders("creatine");
  expect(todayHours("creatine")).toEqual([9, 21]);
});

test("an offline weight log that syncs during the query still suppresses today's reminders", async () => {
  goOnline(true);
  (getOfflineBodyWeightLogs as jest.Mock).mockResolvedValueOnce([{ user_id: "user-1", date: today }]);
  await setLogReminderUser("user-1");
  expect(todayHours("weight")).toEqual([]);
});

test("opening the app the next day extends the schedule without a catch-up notification", async () => {
  await setLogReminderUser("user-1");
  jest.setSystemTime(new Date(2026, 10, 23, 10));
  schedule.mockClear();
  await refreshLogReminders();

  expect(schedule).toHaveBeenCalledTimes(6);
  for (const [request] of schedule.mock.calls) {
    expect(request.trigger.type).toBe("date");
    expect(request.trigger.date.getDate()).toBe(29);
  }
  expect([...pending.values()].some(({ trigger }) =>
    trigger && typeof trigger === "object" && "date" in trigger &&
    trigger.date instanceof Date && trigger.date.getDate() === 22,
  )).toBe(false);
});

test("a dropped connection during the sleep query preserves the locally known log", async () => {
  goOnline(true);
  remoteRows.sleep_logs = [{ log_date: today }];
  await setLogReminderUser("user-1");
  const normalQuery = from.getMockImplementation();
  from.mockImplementation((table: string) => {
    const query = normalQuery?.(table);
    if (table === "sleep_logs") query.abortSignal = async () => { throw new Error("Offline"); };
    return query;
  });
  await refreshLogReminders();
  expect(todayHours("sleep")).toEqual([]);
});

test("cleans up old and signed-out reminders while preserving unrelated notifications", async () => {
  pending.set("legacy", { identifier: "legacy", content: { data: { reminderType: "weight-reminder" } }, trigger: null });
  pending.set("unrelated", { identifier: "unrelated", content: { title: "Other" }, trigger: null });
  await setLogReminderUser("user-1");
  expect(await getLastLogReminderUser()).toBe("user-1");
  expect(cancel).toHaveBeenCalledWith("legacy");
  await setLogReminderUser(null);
  expect([...pending.keys()]).toEqual(["unrelated"]);
  expect(await getLastLogReminderUser()).toBeNull();
});

test("does not schedule or query when notifications are denied", async () => {
  getPermissions.mockResolvedValue({ granted: false });
  goOnline(true);
  await setLogReminderUser("user-1");
  expect(schedule).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});
