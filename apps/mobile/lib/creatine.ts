import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

const OFFLINE_CREATINE_KEY = "offline_creatine_logs";
const CACHED_CREATINE_KEY = "cached_creatine_logs";
const OFFLINE_CREATINE_USER_ID_KEY = "offline_creatine_user_id";

type SyncResult = { synced: number; remaining: number };

let syncPromise: Promise<SyncResult> | null = null;

export type CreatineLog = {
  id: string;
  user_id: string;
  date: string;
  logged_at: string;
  grams: number;
  notes: string | null;
  offline?: boolean;
  temp_id?: string;
};

export type OfflineCreatineLog = Omit<CreatineLog, "id" | "offline"> & {
  temp_id: string;
};

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function isCreatineOnline() {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function cacheOfflineCreatineUserId(userId: string) {
  await AsyncStorage.setItem(OFFLINE_CREATINE_USER_ID_KEY, userId);
}

export async function getOfflineCreatineUserId() {
  return AsyncStorage.getItem(OFFLINE_CREATINE_USER_ID_KEY);
}

export async function resolveCreatineUserId() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      await cacheOfflineCreatineUserId(user.id);
      return user.id;
    }
  } catch (error) {
    console.log("Resolve creatine user error:", error);
  }

  return getOfflineCreatineUserId();
}

export async function getOfflineCreatineLogs() {
  const raw = await AsyncStorage.getItem(OFFLINE_CREATINE_KEY);
  return raw ? (JSON.parse(raw) as OfflineCreatineLog[]) : [];
}

export async function getCachedCreatineLogs() {
  const raw = await AsyncStorage.getItem(CACHED_CREATINE_KEY);
  return raw ? (JSON.parse(raw) as CreatineLog[]) : [];
}

export async function cacheCreatineLogs(logs: CreatineLog[]) {
  await AsyncStorage.setItem(CACHED_CREATINE_KEY, JSON.stringify(logs));
}

async function setOfflineCreatineLogs(logs: OfflineCreatineLog[]) {
  await AsyncStorage.setItem(OFFLINE_CREATINE_KEY, JSON.stringify(logs));
}

export async function saveOfflineCreatineLog(log: OfflineCreatineLog) {
  const existing = await getOfflineCreatineLogs();
  const updated = [log, ...existing.filter((item) => item.date !== log.date)];

  await setOfflineCreatineLogs(updated);
}

export async function removeOfflineCreatineLog(tempId: string) {
  const existing = await getOfflineCreatineLogs();
  const updated = existing.filter((log) => log.temp_id !== tempId);

  await setOfflineCreatineLogs(updated);
}

async function runOfflineCreatineSync(): Promise<SyncResult> {
  const online = await isCreatineOnline();
  if (!online) return { synced: 0, remaining: 0 };

  const logs = await getOfflineCreatineLogs();
  if (logs.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;

  for (const log of logs) {
    const { temp_id, ...payload } = log;

    const { data: existing, error: existingError } = await supabase
      .from("creatine_logs")
      .select("id")
      .eq("user_id", log.user_id)
      .eq("date", log.date)
      .maybeSingle();

    if (!existingError && existing) {
      await removeOfflineCreatineLog(temp_id);
      continue;
    }

    const { error } = await supabase
      .from("creatine_logs")
      .upsert(payload, { onConflict: "user_id,date" });

    if (!error) {
      await removeOfflineCreatineLog(temp_id);
      synced++;
    } else {
      console.log("Offline creatine sync error:", error);
    }
  }

  const remaining = await getOfflineCreatineLogs();

  return {
    synced,
    remaining: remaining.length,
  };
}

export async function syncOfflineCreatineLogs() {
  if (syncPromise) return syncPromise;

  syncPromise = runOfflineCreatineSync().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}

export async function loadCreatineLogs() {
  const online = await isCreatineOnline();

  if (online) {
    await syncOfflineCreatineLogs();
  }

  const offlineLogs = await getOfflineCreatineLogs();
  const mappedOffline: CreatineLog[] = offlineLogs.map((log) => ({
    ...log,
    id: log.temp_id,
    offline: true,
  }));
  const cachedLogs = await getCachedCreatineLogs();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !online) {
    const cachedDates = new Set(cachedLogs.map((log) => log.date));
    return [
      ...mappedOffline.filter((log) => !cachedDates.has(log.date)),
      ...cachedLogs,
    ].sort((a, b) => b.date.localeCompare(a.date));
  }

  await cacheOfflineCreatineUserId(user.id);

  const { data, error } = await supabase
    .from("creatine_logs")
    .select("id, user_id, date, logged_at, grams, notes")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("logged_at", { ascending: false });

  if (error) {
    console.log("Load creatine logs error:", error);
    return mappedOffline.sort((a, b) => b.date.localeCompare(a.date));
  }

  const offlineDates = new Set(mappedOffline.map((log) => log.date));
  const onlineLogs = ((data || []) as CreatineLog[]).filter(
    (log) => !offlineDates.has(log.date),
  );
  await cacheCreatineLogs((data || []) as CreatineLog[]);

  return [...mappedOffline, ...onlineLogs].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

export async function logCreatineForDate({
  date,
  grams = 5,
  notes = null,
}: {
  date: string;
  grams?: number;
  notes?: string | null;
}) {
  const userId = await resolveCreatineUserId();

  if (!userId) {
    throw new Error("Open the app once while online before logging creatine offline.");
  }

  const payload = {
    user_id: userId,
    date,
    logged_at: new Date().toISOString(),
    grams,
    notes,
  };

  const offlineLog: OfflineCreatineLog = {
    temp_id: `offline_creatine_${date}_${Date.now()}`,
    ...payload,
  };

  const online = await isCreatineOnline();

  if (!online) {
    await saveOfflineCreatineLog(offlineLog);
    return { ...offlineLog, id: offlineLog.temp_id, offline: true };
  }

  const { data, error } = await supabase
    .from("creatine_logs")
    .upsert(payload, { onConflict: "user_id,date" })
    .select("id, user_id, date, logged_at, grams, notes")
    .single();

  if (error) {
    console.log("Log creatine error:", error);
    await saveOfflineCreatineLog(offlineLog);
    return { ...offlineLog, id: offlineLog.temp_id, offline: true };
  }

  return data as CreatineLog;
}

export async function deleteCreatineLog(log: CreatineLog) {
  if (log.offline && log.temp_id) {
    await removeOfflineCreatineLog(log.temp_id);
    return;
  }

  const userId = await resolveCreatineUserId();
  if (!userId) return;

  const { error } = await supabase
    .from("creatine_logs")
    .delete()
    .eq("user_id", userId)
    .eq("date", log.date);

  if (error) {
    console.log("Delete creatine log error:", error);
  }
}
