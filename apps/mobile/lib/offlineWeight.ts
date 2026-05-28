import { cacheOfflineBodyWeightKg, isOnline } from "@/lib/offlineCardio";
import {
  cacheOfflineUser,
  getOfflineUserEmail,
  resolveOfflineUserId,
} from "@/lib/offlineUser";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const OFFLINE_WEIGHT_KEY = "offline_body_weight_logs";
const CACHED_WEIGHT_LOGS_KEY = "cached_body_weight_logs";
const CACHED_BODY_STATS_KEY = "cached_body_stats";
const CACHED_WEIGHT_LOG_KEY = "cached_latest_body_weight_log";

type SyncResult = { synced: number; remaining: number };

let syncPromise: Promise<SyncResult> | null = null;

export type BodyStatsCache = {
  id: string;
  user_id: string;
  height_cm: number;
  created_at: string;
  updated_at?: string | null;
};

export type OfflineBodyWeightLog = {
  temp_id: string;
  user_id: string;
  date: string;
  logged_at: string;
  weight_kg: number;
  body_fat_percent: number | null;
  created_at: string;
};

export type BodyWeightLogRecord = OfflineBodyWeightLog & {
  id: string;
  offline?: boolean;
};

export async function getOfflineBodyWeightLogs() {
  const raw = await AsyncStorage.getItem(OFFLINE_WEIGHT_KEY);
  return raw ? (JSON.parse(raw) as OfflineBodyWeightLog[]) : [];
}

export async function getCachedBodyWeightLogs() {
  const raw = await AsyncStorage.getItem(CACHED_WEIGHT_LOGS_KEY);
  return raw ? (JSON.parse(raw) as BodyWeightLogRecord[]) : [];
}

export async function cacheBodyWeightLogs(logs: BodyWeightLogRecord[]) {
  await AsyncStorage.setItem(CACHED_WEIGHT_LOGS_KEY, JSON.stringify(logs));
}

async function setOfflineBodyWeightLogs(logs: OfflineBodyWeightLog[]) {
  await AsyncStorage.setItem(OFFLINE_WEIGHT_KEY, JSON.stringify(logs));
}

function isSamePendingBodyWeightLog(
  a: OfflineBodyWeightLog,
  b: OfflineBodyWeightLog,
) {
  return (
    a.temp_id === b.temp_id ||
    (a.user_id === b.user_id &&
      a.date === b.date &&
      a.weight_kg === b.weight_kg &&
      (a.body_fat_percent ?? null) === (b.body_fat_percent ?? null))
  );
}

export async function saveOfflineBodyWeightLog(log: OfflineBodyWeightLog) {
  const existing = await getOfflineBodyWeightLogs();
  await setOfflineBodyWeightLogs([
    log,
    ...existing.filter((item) => !isSamePendingBodyWeightLog(item, log)),
  ]);
}

export async function removeOfflineBodyWeightLog(tempId: string) {
  const existing = await getOfflineBodyWeightLogs();
  await setOfflineBodyWeightLogs(
    existing.filter((log) => log.temp_id !== tempId),
  );
}

export async function cacheBodyStats(stats: BodyStatsCache | null) {
  if (!stats) return;
  await AsyncStorage.setItem(CACHED_BODY_STATS_KEY, JSON.stringify(stats));
}

export async function getCachedBodyStats() {
  const raw = await AsyncStorage.getItem(CACHED_BODY_STATS_KEY);
  return raw ? (JSON.parse(raw) as BodyStatsCache) : null;
}

export async function cacheLatestBodyWeightLog(log: BodyWeightLogRecord | null) {
  if (!log) return;
  await AsyncStorage.setItem(CACHED_WEIGHT_LOG_KEY, JSON.stringify(log));
  await cacheOfflineBodyWeightKg(Number(log.weight_kg));
}

export async function getCachedLatestBodyWeightLog() {
  const raw = await AsyncStorage.getItem(CACHED_WEIGHT_LOG_KEY);
  return raw ? (JSON.parse(raw) as BodyWeightLogRecord) : null;
}

export async function logBodyWeightOffline({
  date,
  logged_at,
  weight_kg,
  body_fat_percent,
}: {
  date: string;
  logged_at: string;
  weight_kg: number;
  body_fat_percent: number | null;
}) {
  const userId = await resolveOfflineUserId();

  if (!userId) {
    throw new Error("Open the app once while online before logging weight offline.");
  }

  const log: OfflineBodyWeightLog = {
    temp_id: `offline_weight_${date}_${Date.now()}`,
    user_id: userId,
    date,
    logged_at,
    weight_kg,
    body_fat_percent,
    created_at: new Date().toISOString(),
  };

  await saveOfflineBodyWeightLog(log);

  const mapped = { ...log, id: log.temp_id, offline: true };
  await cacheLatestBodyWeightLog(mapped);

  return mapped;
}

export async function loadBodyWeightLogs() {
  const online = await isOnline();

  if (online) {
    await syncOfflineBodyWeightLogs();
  }

  const offlineLogs = (await getOfflineBodyWeightLogs()).map((log) => ({
    ...log,
    id: log.temp_id,
    offline: true,
  }));
  const cachedLogs = await getCachedBodyWeightLogs();

  const userId = await resolveOfflineUserId();
  if (!userId || !online) {
    const cachedDates = new Set(cachedLogs.map((log) => log.date));
    return [
      ...offlineLogs.filter((log) => !cachedDates.has(log.date)),
      ...cachedLogs,
    ].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  }

  const { data, error } = await supabase
    .from("body_weight_logs")
    .select("id, user_id, date, logged_at, weight_kg, body_fat_percent, created_at")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.log("Load body weight logs error:", error);
    return offlineLogs.sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  }

  const onlineLogs = (data || []) as BodyWeightLogRecord[];
  await cacheBodyWeightLogs(onlineLogs);
  const merged = [...offlineLogs, ...onlineLogs].sort((a, b) =>
    b.logged_at.localeCompare(a.logged_at),
  );

  if (merged[0]) {
    await cacheLatestBodyWeightLog(merged[0]);
  }

  return merged;
}

export async function loadOfflineProfileFallback() {
  const [email, stats, latestWeightLog] = await Promise.all([
    getOfflineUserEmail(),
    getCachedBodyStats(),
    getCachedLatestBodyWeightLog(),
  ]);

  return {
    email,
    stats,
    latestWeightLog,
  };
}

async function runOfflineBodyWeightSync(): Promise<SyncResult> {
  const online = await isOnline();
  if (!online) return { synced: 0, remaining: 0 };

  const logs = await getOfflineBodyWeightLogs();
  if (logs.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;

  for (const log of logs) {
    const { temp_id, ...payload } = log;

    const { data: existing, error: existingError } = await supabase
      .from("body_weight_logs")
      .select("id")
      .eq("user_id", log.user_id)
      .eq("date", log.date)
      .limit(1);

    if (!existingError && existing && existing.length > 0) {
      await removeOfflineBodyWeightLog(temp_id);
      synced++;
      continue;
    }

    const { data, error } = await supabase
      .from("body_weight_logs")
      .insert(payload)
      .select("id, user_id, date, logged_at, weight_kg, body_fat_percent, created_at")
      .single();

    if (!error && data) {
      await removeOfflineBodyWeightLog(temp_id);
      await cacheLatestBodyWeightLog(data as BodyWeightLogRecord);
      synced++;
    } else {
      console.log("Offline body weight sync error:", error);
    }
  }

  const remaining = await getOfflineBodyWeightLogs();

  return {
    synced,
    remaining: remaining.length,
  };
}

export async function syncOfflineBodyWeightLogs() {
  if (syncPromise) return syncPromise;

  syncPromise = runOfflineBodyWeightSync().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}

export async function cacheCurrentSessionUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    await cacheOfflineUser(session.user);
  }
}
