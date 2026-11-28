import { getCachedCreatineLogs, getOfflineCreatineLogs } from "@/lib/creatine";
import { toLocalDateKey } from "@/lib/dates";
import { getCachedBodyWeightLogs, getOfflineBodyWeightLogs } from "@/lib/offlineWeight";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import {
  AndroidImportance,
  SchedulableTriggerInputTypes,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  getPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  type NotificationRequest,
  type NotificationRequestInput,
} from "expo-notifications";
import { Platform } from "react-native";

const rules = {
  sleep: {
    title: "Sleep check-in", body: "Log your sleep for today.",
    screen: "sleep", hours: [9, 21], table: "sleep_logs", dateColumn: "log_date",
  },
  weight: {
    title: "Weight check-in", body: "Log your weight for today.",
    screen: "profile", hours: [7, 20], table: "body_weight_logs", dateColumn: "date",
    pending: getOfflineBodyWeightLogs, cached: getCachedBodyWeightLogs,
  },
  creatine: {
    title: "Creatine check-in", body: "Mark your creatine intake for today.",
    screen: "creatine", hours: [9, 21], table: "creatine_logs", dateColumn: "date",
    pending: getOfflineCreatineLogs, cached: getCachedCreatineLogs,
  },
} as const;

type ConditionalReminder = keyof typeof rules;
type Reminder = ConditionalReminder | "macros";
const conditionalReminders = Object.keys(rules) as ConditionalReminder[];
const macros = { title: "Macros check-in", body: "Log your calories, protein, carbs, and fat.", screen: "macros" };
const channelId = (kind: Reminder) => `${kind}-reminders`;
const reminderType = (kind: Reminder) => `${kind}-reminder`;
const statusKey = (userId: string, kind: ConditionalReminder) => `log-reminder-dates:${userId}:${kind}`;
const OWNER_KEY = "log-reminder-owner";
const REMINDER_DAYS = 7;

let activeUserId: string | null | undefined;
let channelsReady = false;
let queue = Promise.resolve();

export function configureLogReminders() {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function enqueue(work: () => Promise<void>) {
  queue = queue.then(work).catch((error) => {
    console.warn("Log reminder update failed:", error);
  });
  return queue;
}

export function setLogReminderUser(userId: string | null) {
  if (userId === activeUserId) return queue;
  activeUserId = userId;
  return enqueue(async () => {
    if (userId) await AsyncStorage.setItem(OWNER_KEY, userId);
    else await AsyncStorage.removeItem(OWNER_KEY);
    await reconcile(conditionalReminders, true);
  });
}

export function getLastLogReminderUser() {
  return AsyncStorage.getItem(OWNER_KEY);
}

export function refreshLogReminders(kind?: ConditionalReminder) {
  return enqueue(() => reconcile(kind ? [kind] : conditionalReminders, true));
}

export function recordReminderLogChange(
  userId: string,
  kind: ConditionalReminder,
  change: { added?: string; removed?: string },
) {
  return enqueue(async () => {
    const key = statusKey(userId, kind);
    const dates = await readDates(key);
    if (change.removed) dates.delete(change.removed);
    if (change.added) dates.add(change.added);
    await storeDates(key, dates);
    if (activeUserId === userId) await reconcile([kind], false);
  });
}

async function prepareChannels() {
  if (Platform.OS !== "android" || channelsReady) return;
  for (const kind of [...conditionalReminders, "macros"] as const) {
    await setNotificationChannelAsync(channelId(kind), {
      name: `${kind[0].toUpperCase()}${kind.slice(1)} reminders`,
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  channelsReady = true;
}

async function readDates(key: string): Promise<Set<string>> {
  const json = await AsyncStorage.getItem(key);
  return new Set(json ? JSON.parse(json) as string[] : []);
}

function storeDates(key: string, dates: Set<string>) {
  const today = toLocalDateKey();
  return AsyncStorage.setItem(key, JSON.stringify([...dates].filter((date) => date >= today)));
}

async function getLoggedDates(
  userId: string, kind: ConditionalReminder, from: string, to: string, online: boolean,
) {
  const rule = rules[kind];
  const key = statusKey(userId, kind);
  // Read pending writes first so a sync completing during the server query cannot hide a log.
  const pending = "pending" in rule ? await rule.pending() : [];
  let dates = await readDates(key);
  let loaded = false;
  if (online) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const { data, error } = await supabase.from(rule.table)
        .select(rule.dateColumn).eq("user_id", userId)
        .gte(rule.dateColumn, from).lte(rule.dateColumn, to)
        .abortSignal(controller.signal);
      if (!error && data) {
        dates = new Set([
          ...[...dates].filter((date) => date > to),
          ...data.map((row) => "date" in row ? row.date : row.log_date),
        ]);
        await storeDates(key, dates);
        loaded = true;
      }
    } catch {
      // A connection can drop during the query. Keep the local dates.
    } finally {
      clearTimeout(timeout);
    }
  }

  if ("pending" in rule) {
    for (const log of pending) if (log.user_id === userId) dates.add(log.date);
    if (!loaded) {
      for (const log of await rule.cached()) if (log.user_id === userId) dates.add(log.date);
    }
  }
  return dates;
}

function ownedKind(request: NotificationRequest) {
  return ([...conditionalReminders, "macros"] as const).find((kind) => {
    const rule = kind === "macros" ? macros : rules[kind];
    const { title, data } = request.content;
    return data?.reminderType === reminderType(kind) ||
      (title === rule.title && data?.screen === rule.screen);
  });
}

function makeRequest(userId: string, kind: Reminder, date?: Date) {
  const rule = kind === "macros" ? macros : rules[kind];
  return {
    identifier: `mxrvs:${userId}:${kind}:${date?.getTime() ?? "21-daily"}`,
    content: {
      title: rule.title, body: rule.body, sound: true,
      data: { screen: rule.screen, reminderType: reminderType(kind) },
    },
    trigger: date
      ? { type: SchedulableTriggerInputTypes.DATE, date, channelId: channelId(kind) }
      : { type: SchedulableTriggerInputTypes.DAILY, hour: 21, minute: 0, channelId: channelId(kind) },
  } satisfies NotificationRequestInput;
}

async function reconcile(kinds: ConditionalReminder[], checkRemote: boolean) {
  const userId = activeUserId;
  if (userId === undefined) return;
  if (userId) {
    await prepareChannels();
    if (!(await getPermissionsAsync()).granted) return;
  }

  const desired = new Map<string, ReturnType<typeof makeRequest>>();
  if (userId) {
    const now = new Date();
    const days = Array.from({ length: REMINDER_DAYS }, (_, offset) => {
      const day = new Date(now);
      day.setDate(day.getDate() + offset);
      day.setHours(0, 0, 0, 0);
      return day;
    });
    const network = checkRemote ? await NetInfo.fetch().catch(() => null) : null;
    const online = Boolean(network?.isConnected && network.isInternetReachable !== false);
    const loggedDates = await Promise.all(kinds.map((kind) =>
      getLoggedDates(userId, kind, toLocalDateKey(days[0]), toLocalDateKey(days[days.length - 1]), online),
    ));
    for (const [index, kind] of kinds.entries()) {
      for (const day of days) {
        if (loggedDates[index].has(toLocalDateKey(day))) continue;
        for (const hour of rules[kind].hours) {
          const date = new Date(day);
          date.setHours(hour);
          const request = makeRequest(userId, kind, date);
          desired.set(request.identifier, request);
        }
      }
    }
    const request = makeRequest(userId, "macros");
    desired.set(request.identifier, request);
  }

  const scheduled = await getAllScheduledNotificationsAsync();
  if (activeUserId !== userId) return;
  for (const request of scheduled) {
    const kind = ownedKind(request);
    if (!kind || (userId && kind !== "macros" && !kinds.includes(kind))) continue;
    if (!desired.delete(request.identifier)) {
      await cancelScheduledNotificationAsync(request.identifier);
    }
  }
  for (const request of desired.values()) {
    if (activeUserId !== userId) return;
    const trigger = request.trigger;
    // Keep a pending alarm if Android delayed delivery, but never schedule a missed slot.
    if (trigger.type === SchedulableTriggerInputTypes.DATE && trigger.date.getTime() <= Date.now()) continue;
    await scheduleNotificationAsync(request);
  }
}
