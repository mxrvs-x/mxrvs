import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

const OFFLINE_CARDIO_KEY = "offline_cardio_sessions";
const OFFLINE_CARDIO_USER_ID_KEY = "offline_cardio_user_id";

export type OfflineCardioSession = {
  temp_id: string;
  user_id: string;
  session_date: string;
  cardio_type: "walking" | "running";
  cardio_source: "outdoor" | "treadmill" | "manual";
  distance_km: number;
  duration_seconds: number;
  steps: number;
  calories_burned: number;
  avg_heart_rate: number | null;
  notes: string | null;
  route: any[] | null;
  is_mock: boolean;
  created_at: string;
};

export async function isOnline() {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function getOfflineCardioSessions() {
  const raw = await AsyncStorage.getItem(OFFLINE_CARDIO_KEY);
  return raw ? (JSON.parse(raw) as OfflineCardioSession[]) : [];
}

export async function saveOfflineCardioSession(session: OfflineCardioSession) {
  const existing = await getOfflineCardioSessions();
  const updated = [session, ...existing];

  await AsyncStorage.setItem(OFFLINE_CARDIO_KEY, JSON.stringify(updated));
}

export async function cacheOfflineCardioUserId(userId: string) {
  await AsyncStorage.setItem(OFFLINE_CARDIO_USER_ID_KEY, userId);
}

export async function getOfflineCardioUserId() {
  return AsyncStorage.getItem(OFFLINE_CARDIO_USER_ID_KEY);
}

export async function resolveCardioUserId() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      await cacheOfflineCardioUserId(user.id);
      return user.id;
    }
  } catch (error) {
    console.log("Resolve cardio user error:", error);
  }

  return getOfflineCardioUserId();
}

export async function removeOfflineCardioSession(tempId: string) {
  const existing = await getOfflineCardioSessions();
  const updated = existing.filter((s) => s.temp_id !== tempId);

  await AsyncStorage.setItem(OFFLINE_CARDIO_KEY, JSON.stringify(updated));
}

export async function syncOfflineCardioSessions() {
  const online = await isOnline();
  if (!online) return { synced: 0, remaining: 0 };

  const sessions = await getOfflineCardioSessions();
  if (sessions.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;

  for (const session of sessions) {
    const { temp_id, ...payload } = session;

    const { error } = await supabase.from("cardio_sessions").insert(payload);

    if (!error) {
      await removeOfflineCardioSession(temp_id);
      synced++;
    } else {
      console.log("Offline cardio sync error:", error);
    }
  }

  const remaining = await getOfflineCardioSessions();

  return {
    synced,
    remaining: remaining.length,
  };
}
