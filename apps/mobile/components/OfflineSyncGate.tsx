import { syncOfflineCreatineLogs } from "@/lib/creatine";
import { syncOfflineCardioSessions } from "@/lib/offlineCardio";
import {
  cacheCurrentSessionUser,
  syncOfflineBodyWeightLogs,
} from "@/lib/offlineWeight";
import { syncOfflineWorkouts } from "@/lib/offlineWorkouts";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";

async function syncOfflineQueues() {
  await cacheCurrentSessionUser().catch(() => {});
  await Promise.allSettled([
    syncOfflineCardioSessions(),
    syncOfflineCreatineLogs(),
    syncOfflineBodyWeightLogs(),
    syncOfflineWorkouts(),
  ]);
}

export default function OfflineSyncGate() {
  useEffect(() => {
    syncOfflineQueues();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncOfflineQueues();
      }
    });

    return () => unsubscribe();
  }, []);

  return null;
}
