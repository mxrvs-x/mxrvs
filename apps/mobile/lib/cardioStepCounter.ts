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
 * taken after this subscription starts. Android uses our foreground native
 * tracker when the hardware sensor exists; other devices use Expo Pedometer.
 */
export async function startCardioStepCounter(
  onSteps: (delta: number) => void,
): Promise<StopCardioStepCounter> {
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

  const available = await Pedometer.isAvailableAsync().catch(() => false);
  if (!available) return () => undefined;

  // Expo's Android bridge deliberately emits an initial synthetic value of 1,
  // while iOS reports real subscription steps. Ignore only Android's baseline.
  let lastReportedSteps: number | null = Platform.OS === "android" ? null : 0;
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
}
