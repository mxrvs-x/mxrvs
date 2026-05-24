import {
  configureWeightNotifications,
  syncWeightReminderState,
} from "@/lib/weightNotifications";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";

export default function WeightReminderGate() {
  useEffect(() => {
    configureWeightNotifications();
    syncWeightReminderState();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncWeightReminderState();
      }
    });

    return () => unsubscribe();
  }, []);

  return null;
}
