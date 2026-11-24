import {
  getNativeAndroidStepSnapshot,
  isNativeAndroidStepTrackerAvailable,
  startNativeAndroidStepTracker,
} from "@/lib/androidStepTracker";
import { Pedometer } from "expo-sensors";
import { Platform } from "react-native";

const NATIVE_POLL_INTERVAL_MS = 1_000;

export type StopCardioStepCounter = () => void;

/**
 * Watches the device's standard step-counter sensor and reports only steps
 * taken after this subscription starts. Active cardio prefers Expo's direct
 * sensor listener for step-by-step UI updates. The native daily tracker remains
 * a fallback for phones that expose a supported sensor only through our module.
 */
export async function startCardioStepCounter(
  onSteps: (delta: number) => void,
): Promise<StopCardioStepCounter> {
  const expoAvailable = await Pedometer.isAvailableAsync().catch(() => false);

  if (expoAvailable) {
    // Expo's Android bridge emits a baseline value when its listener starts.
    // Ignore that baseline, then report each subsequent hardware update.
    let lastReportedSteps: number | null = Platform.OS === "android" ? null : 0;

    try {
      const subscription = Pedometer.watchStepCount((result) => {
        const currentSteps = Math.max(0, Math.floor(result.steps));
        if (lastReportedSteps === null) {
          lastReportedSteps = currentSteps;
          return;
        }

        const delta = Math.max(0, currentSteps - lastReportedSteps);
        lastReportedSteps = currentSteps;
        if (delta > 0) onSteps(delta);
      });

      return () => subscription.remove();
    } catch (error) {
      console.log("Start immediate cardio step listener error:", error);
    }
  }

  if (
    Platform.OS === "android" &&
    (await isNativeAndroidStepTrackerAvailable())
  ) {
    const initial = await startNativeAndroidStepTracker();

    if (initial) {
      let lastDate = initial.date;
      let lastSteps = initial.steps;
      let polling = false;

      const interval = setInterval(async () => {
        if (polling) return;
        polling = true;

        try {
          const current = await getNativeAndroidStepSnapshot();
          if (!current) return;

          // A day rollover or sensor reboot creates a new baseline. Never turn
          // that reset into a negative or unusually large cardio step count.
          if (current.date !== lastDate || current.steps < lastSteps) {
            lastDate = current.date;
            lastSteps = current.steps;
            return;
          }

          const delta = current.steps - lastSteps;
          lastSteps = current.steps;

          if (delta > 0) onSteps(delta);
        } finally {
          polling = false;
        }
      }, NATIVE_POLL_INTERVAL_MS);

      return () => clearInterval(interval);
    }
  }

  return () => undefined;
}
