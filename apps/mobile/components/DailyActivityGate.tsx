import {
  refreshDailyActivity,
  startDailyActivityTracking,
  stopDailyActivityTracking,
} from "@/lib/dailyActivity";
import { useEffect } from "react";
import { AppState } from "react-native";

export default function DailyActivityGate() {
  useEffect(() => {
    void startDailyActivityTracking();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void startDailyActivityTracking();
      } else {
        void stopDailyActivityTracking();
        void refreshDailyActivity();
      }
    });

    return () => {
      subscription.remove();
      void stopDailyActivityTracking();
    };
  }, []);

  return null;
}
