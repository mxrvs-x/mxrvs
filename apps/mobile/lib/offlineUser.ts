import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const OFFLINE_USER_ID_KEY = "offline_user_id";
const OFFLINE_USER_EMAIL_KEY = "offline_user_email";

export async function cacheOfflineUser(user: { id: string; email?: string | null }) {
  await AsyncStorage.setItem(OFFLINE_USER_ID_KEY, user.id);

  if (user.email) {
    await AsyncStorage.setItem(OFFLINE_USER_EMAIL_KEY, user.email);
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
