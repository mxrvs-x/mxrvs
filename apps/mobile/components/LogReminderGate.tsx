import {
  configureLogReminders,
  getLastLogReminderUser,
  refreshLogReminders,
  setLogReminderUser,
} from "@/lib/logReminders";
import { supabase } from "@/lib/supabase";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";

export default function LogReminderGate() {
  useEffect(() => {
    configureLogReminders();
    let authRevision = 0;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    let wasOnline: boolean | undefined;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && event !== "SIGNED_OUT" && event !== "INITIAL_SESSION") return;
      const revision = ++authRevision;
      clearTimeout(authTimer);
      // Run outside Supabase's auth callback before reading any log tables.
      authTimer = setTimeout(async () => {
        if (session || event === "SIGNED_OUT") {
          void setLogReminderUser(session?.user.id ?? null);
          return;
        }
        const network = await NetInfo.fetch().catch(() => null);
        const online = Boolean(network?.isConnected && network.isInternetReachable !== false);
        const userId = online ? null : await getLastLogReminderUser().catch(() => null);
        if (revision === authRevision && (userId || online)) void setLogReminderUser(userId);
      }, 0);
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshLogReminders();
    });
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (online && wasOnline === false) void refreshLogReminders();
      wasOnline = online;
    });

    return () => {
      authRevision += 1;
      clearTimeout(authTimer);
      subscription.unsubscribe();
      appState.remove();
      unsubscribeNetwork();
    };
  }, []);

  return null;
}
