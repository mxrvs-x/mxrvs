import {
  getOfflineCreatineLogs,
  syncOfflineCreatineLogs,
  toDateKey,
} from "@/lib/creatine";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHANNEL_ID = "creatine-reminders";
const REMINDER_ID_KEY = "creatine_reminder_notification_id";
const LAST_IMMEDIATE_KEY = "creatine_last_immediate_notification_date";
const REMINDER_TYPE = "creatine-reminder";
const MORNING_HOUR = 9;
const EVENING_HOUR = 21;

let syncPromise: Promise<void> | null = null;

export function configureCreatineNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () =>
      ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }) as any,
  });
}

async function ensureNotificationPermission() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Creatine reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const current = await Notifications.getPermissionsAsync();

  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function nextReminderDate(hasLoggedToday: boolean) {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);

  if (!hasLoggedToday && now.getHours() < MORNING_HOUR) {
    next.setHours(MORNING_HOUR);
    return next;
  }

  if (!hasLoggedToday && now.getHours() < EVENING_HOUR) {
    next.setHours(EVENING_HOUR);
    return next;
  }

  next.setDate(next.getDate() + 1);
  next.setHours(MORNING_HOUR);
  return next;
}

async function scheduleNextReminder(hasLoggedToday: boolean) {
  const previousId = await AsyncStorage.getItem(REMINDER_ID_KEY);
  const scheduledNotifications =
    await Notifications.getAllScheduledNotificationsAsync().catch(() => []);

  const staleReminderIds = scheduledNotifications
    .filter((notification) => {
      const data = notification.content.data;

      return (
        notification.identifier === previousId ||
        data?.reminderType === REMINDER_TYPE ||
        (notification.content.title === "Creatine check-in" &&
          data?.screen === "creatine")
      );
    })
    .map((notification) => notification.identifier);

  if (staleReminderIds.length > 0) {
    await Promise.all(
      staleReminderIds.map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
      ),
    );
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Creatine check-in",
      body: "No creatine log for today yet. Take 5g and mark it done.",
      sound: true,
      data: { screen: "creatine", reminderType: REMINDER_TYPE },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextReminderDate(hasLoggedToday),
      channelId: CHANNEL_ID,
    },
  });

  await AsyncStorage.setItem(REMINDER_ID_KEY, identifier);
}

async function hasLoggedCreatineToday(userId: string) {
  const today = toDateKey(new Date());
  const offlineLogs = await getOfflineCreatineLogs();

  if (offlineLogs.some((log) => log.date === today)) {
    return true;
  }

  const state = await NetInfo.fetch();
  const online = Boolean(state.isConnected && state.isInternetReachable !== false);

  if (!online) return false;

  await syncOfflineCreatineLogs();

  const { data, error } = await supabase
    .from("creatine_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (error) {
    console.log("Creatine reminder check error:", error);
    return false;
  }

  return Boolean(data);
}

async function runCreatineReminderSync({
  allowImmediate = true,
}: {
  allowImmediate?: boolean;
} = {}) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return;

    const granted = await ensureNotificationPermission();
    if (!granted) return;

    const loggedToday = await hasLoggedCreatineToday(session.user.id);
    await scheduleNextReminder(loggedToday);

    const today = toDateKey(new Date());
    const hour = new Date().getHours();
    const lastImmediateDate = await AsyncStorage.getItem(LAST_IMMEDIATE_KEY);

    if (
      allowImmediate &&
      !loggedToday &&
      hour >= MORNING_HOUR &&
      lastImmediateDate !== today
    ) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Creatine check-in",
          body: "You have not logged creatine today. Take it now?",
          sound: true,
          data: { screen: "creatine", reminderType: REMINDER_TYPE },
        },
        trigger: null,
      });

      await AsyncStorage.setItem(LAST_IMMEDIATE_KEY, today);
    }
  } catch (error) {
    console.log("Creatine reminder sync error:", error);
  }
}

export async function syncCreatineReminderState(
  options: {
    allowImmediate?: boolean;
  } = {},
) {
  if (syncPromise) return syncPromise;

  syncPromise = runCreatineReminderSync(options).finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}
