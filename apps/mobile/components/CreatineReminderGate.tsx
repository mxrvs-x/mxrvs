import {
  configureCreatineNotifications,
  syncCreatineReminderState,
} from "@/lib/creatineNotifications";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";

export default function CreatineReminderGate() {
  useEffect(() => {
    configureCreatineNotifications();
    syncCreatineReminderState();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncCreatineReminderState();
      }
    });

    return () => unsubscribe();
  }, []);

  return null;
}
