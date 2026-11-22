import { supabase } from "@/lib/supabase";
import { setNativeAndroidBodyMetrics } from "@/lib/androidStepTracker";
import AsyncStorage from "@react-native-async-storage/async-storage";

const OFFLINE_USER_ID_KEY = "offline_user_id";
const OFFLINE_USER_EMAIL_KEY = "offline_user_email";

const USER_SCOPED_CACHE_KEYS = [
  "cached_workouts",
  "cached_workout_sets",
  "cached_workout_exercises",
  "cached_cardio_sessions",
  "cached_creatine_logs",
  "cached_body_weight_logs",
  "cached_body_stats",
  "cached_latest_body_weight_log",
  "offline_cardio_weight_kg",
  "offline_cardio_user_id",
  "offline_creatine_user_id",
  "daily_pedometer_activity_v1",
  "pending_overall_activity_v1",
  "background_cardio_route_points",
  "creatine_reminder_notification_id",
  "creatine_last_immediate_notification_date",
  "weight_reminder_notification_id",
  "weight_last_immediate_notification_date",
];

export async function cacheOfflineUser(user: { id: string; email?: string | null }) {
  const previousUserId = await AsyncStorage.getItem(OFFLINE_USER_ID_KEY);
  if (previousUserId && previousUserId !== user.id) {
    await AsyncStorage.multiRemove(USER_SCOPED_CACHE_KEYS);
    await setNativeAndroidBodyMetrics(null, null).catch(() => null);
  }

  await AsyncStorage.setItem(OFFLINE_USER_ID_KEY, user.id);

  if (user.email) {
    await AsyncStorage.setItem(OFFLINE_USER_EMAIL_KEY, user.email);
  } else {
    await AsyncStorage.removeItem(OFFLINE_USER_EMAIL_KEY);
  }
}

export async function getOfflineUserId() {
  return AsyncStorage.getItem(OFFLINE_USER_ID_KEY);
}

export async function getOfflineUserEmail() {
  return AsyncStorage.getItem(OFFLINE_USER_EMAIL_KEY);
}

export async function resolveOfflineUserId() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.id) {
      await cacheOfflineUser(session.user);
      return session.user.id;
    }
  } catch (error) {
    console.log("Resolve session user error:", error);
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      await cacheOfflineUser(user);
      return user.id;
    }
  } catch (error) {
    console.log("Resolve network user error:", error);
  }

  return getOfflineUserId();
}
