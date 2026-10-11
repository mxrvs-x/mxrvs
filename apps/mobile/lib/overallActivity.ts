import {
  archiveCurrentNativeAndroidActivity,
  getNativeAndroidArchivedActivities,
  hasNativeAndroidStepTracker,
  removeNativeAndroidArchivedActivity,
  type NativeArchivedActivity,
} from "@/lib/androidStepTracker";
import {
  getDailyActivitySnapshot,
  refreshDailyActivity,
  type DailyActivity,
} from "@/lib/dailyActivity";
import { isOnline } from "@/lib/offlineCardio";
import { resolveOfflineUserId } from "@/lib/offlineUser";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const PENDING_OVERALL_ACTIVITY_KEY = "pending_overall_activity_v1";

type ArchivedActivity = {
  activityDate: string;
  steps: number;
  durationSeconds: number;
  caloriesBurned: number;
  source: "native" | "javascript";
};

let syncPromise: Promise<{ synced: number; remaining: number }> | null = null;
let archiveTimer: ReturnType<typeof setTimeout> | null = null;

async function getJavaScriptQueue() {
  const raw = await AsyncStorage.getItem(PENDING_OVERALL_ACTIVITY_KEY);
  return raw ? (JSON.parse(raw) as ArchivedActivity[]) : [];
}

async function saveJavaScriptQueue(queue: ArchivedActivity[]) {
  await AsyncStorage.setItem(PENDING_OVERALL_ACTIVITY_KEY, JSON.stringify(queue));
}

async function queueJavaScriptSnapshot(activity: DailyActivity) {
  const current = await getJavaScriptQueue();
  const archived: ArchivedActivity = {
    activityDate: activity.date,
    steps: activity.steps,
    durationSeconds: activity.movingSeconds,
    caloriesBurned: activity.caloriesBurned,
    source: "javascript",
  };
  await saveJavaScriptQueue([
    ...current.filter((item) => item.activityDate !== archived.activityDate),
    archived,
  ]);
}

async function collectPendingActivities() {
  const javascript = await getJavaScriptQueue();
  const native: ArchivedActivity[] =
    Platform.OS === "android" && hasNativeAndroidStepTracker()
      ? (await getNativeAndroidArchivedActivities()).map(
          (item: NativeArchivedActivity) => ({ ...item, source: "native" }),
        )
      : [];
  const byDate = new Map<string, ArchivedActivity>();

  for (const item of [...javascript, ...native]) {
    const existing = byDate.get(item.activityDate);
    if (!existing || item.steps >= existing.steps) byDate.set(item.activityDate, item);
  }

  return [...byDate.values()].sort((a, b) =>
    a.activityDate.localeCompare(b.activityDate),
  );
}

async function removeSyncedActivity(activity: ArchivedActivity) {
  const javascript = await getJavaScriptQueue();
  await saveJavaScriptQueue(
    javascript.filter(
      (item) =>
        item.activityDate !== activity.activityDate ||
        item.steps > activity.steps,
    ),
  );
  if (Platform.OS === "android" && hasNativeAndroidStepTracker()) {
    await removeNativeAndroidArchivedActivity(
      activity.activityDate,
      activity.steps,
    );
  }
}

async function upsertOverallActivity(
  userId: string,
  activity: ArchivedActivity,
) {
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    activity_date: activity.activityDate,
    steps: Math.max(0, Math.floor(activity.steps)),
    calories_burned: Math.max(0, activity.caloriesBurned),
    duration_seconds: Math.max(0, Math.floor(activity.durationSeconds)),
    updated_at: now,
  };
  const { data: existing, error: lookupError } = await supabase
    .from("overall_activity")
    .select("id")
    .eq("user_id", userId)
    .eq("activity_date", activity.activityDate)
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing?.id) {
    const { error } = await supabase
      .from("overall_activity")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("overall_activity")
    .insert({ ...payload, created_at: now });
  if (error) throw error;
}

async function runSync() {
  if (!(await isOnline())) {
    return { synced: 0, remaining: (await collectPendingActivities()).length };
  }
  const userId = await resolveOfflineUserId();
  if (!userId) {
    return { synced: 0, remaining: (await collectPendingActivities()).length };
  }
  const pending = await collectPendingActivities();
  let synced = 0;

  for (const activity of pending) {
    try {
      await upsertOverallActivity(userId, activity);
      await removeSyncedActivity(activity);
      synced += 1;
    } catch (error) {
      console.log("Overall activity sync error:", error);
    }
  }

  return { synced, remaining: (await collectPendingActivities()).length };
}

export async function syncArchivedOverallActivities() {
  if (syncPromise) return syncPromise;
  syncPromise = runSync().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}

export async function archiveCurrentOverallActivity() {
  if (Platform.OS === "android" && hasNativeAndroidStepTracker()) {
    await archiveCurrentNativeAndroidActivity();
  } else {
    const refreshed = await refreshDailyActivity().catch(() => null);
    await queueJavaScriptSnapshot(refreshed ?? getDailyActivitySnapshot());
  }
  return syncArchivedOverallActivities();
}

function millisecondsUntilArchive() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(23, 59, 59, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

export function startOverallActivityArchiveScheduler() {
  if (archiveTimer) clearTimeout(archiveTimer);

  const schedule = () => {
    archiveTimer = setTimeout(async () => {
      await archiveCurrentOverallActivity().catch((error) => {
        console.log("Archive overall activity error:", error);
      });
      schedule();
    }, millisecondsUntilArchive());
  };

  schedule();
  return () => {
    if (archiveTimer) clearTimeout(archiveTimer);
    archiveTimer = null;
  };
}
