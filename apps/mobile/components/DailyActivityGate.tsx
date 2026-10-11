import {
  refreshDailyActivity,
  startDailyActivityTracking,
  stopDailyActivityTracking,
} from "@/lib/dailyActivity";
import {
  startOverallActivityArchiveScheduler,
  syncArchivedOverallActivities,
} from "@/lib/overallActivity";
import { useEffect } from "react";
import { AppState } from "react-native";

export default function DailyActivityGate() {
  useEffect(() => {
    void startDailyActivityTracking().then(() =>
      syncArchivedOverallActivities(),
    );
    const stopArchiveScheduler = startOverallActivityArchiveScheduler();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void startDailyActivityTracking().then(() =>
          syncArchivedOverallActivities(),
        );
      } else {
        void stopDailyActivityTracking();
        void refreshDailyActivity();
      }
    });

    return () => {
      subscription.remove();
      stopArchiveScheduler();
      void stopDailyActivityTracking();
    };
  }, []);

  return null;
}
