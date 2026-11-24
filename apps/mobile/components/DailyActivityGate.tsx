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

const ACTIVE_REFRESH_INTERVAL_MS = 5_000;

export default function DailyActivityGate() {
  useEffect(() => {
    let appIsActive = AppState.currentState === "active";
    let refreshInFlight = false;

    const refreshWhileActive = async () => {
      if (!appIsActive || refreshInFlight) return;
      refreshInFlight = true;
      try {
        await refreshDailyActivity({ syncBodyMetrics: false });
      } finally {
        refreshInFlight = false;
      }
    };

    void startDailyActivityTracking()
      .then(() => syncArchivedOverallActivities())
      .then(() => refreshWhileActive());
    const stopArchiveScheduler = startOverallActivityArchiveScheduler();
    const refreshInterval = setInterval(
      () => void refreshWhileActive(),
      ACTIVE_REFRESH_INTERVAL_MS,
    );

    const subscription = AppState.addEventListener("change", (state) => {
      appIsActive = state === "active";
      if (state === "active") {
        void startDailyActivityTracking()
          .then(() => syncArchivedOverallActivities())
          .then(() => refreshWhileActive());
      } else {
        void stopDailyActivityTracking();
        void refreshDailyActivity();
      }
    });

    return () => {
      subscription.remove();
      clearInterval(refreshInterval);
      stopArchiveScheduler();
      void stopDailyActivityTracking();
    };
  }, []);

  return null;
}
