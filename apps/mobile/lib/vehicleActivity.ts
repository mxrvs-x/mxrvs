import { getNativeAndroidStepSnapshot } from "@/lib/androidStepTracker";
import { Platform } from "react-native";

const POLL_INTERVAL_MS = 2_000;

const listeners = new Set<(inVehicle: boolean) => void>();
let inVehicle = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function getVehicleActivitySnapshot() {
  return inVehicle;
}

export async function refreshVehicleActivity() {
  if (Platform.OS !== "android") return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = getNativeAndroidStepSnapshot()
    .then((snapshot) => Boolean(snapshot?.inVehicle))
    .catch(() => false)
    .then((nextInVehicle) => {
      if (nextInVehicle !== inVehicle) {
        inVehicle = nextInVehicle;
        listeners.forEach((listener) => listener(inVehicle));
      }

      return inVehicle;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export function subscribeVehicleActivity(
  listener: (inVehicle: boolean) => void,
) {
  if (Platform.OS !== "android") return () => undefined;

  listeners.add(listener);
  listener(inVehicle);
  void refreshVehicleActivity();

  if (!pollTimer) {
    pollTimer = setInterval(() => {
      void refreshVehicleActivity();
    }, POLL_INTERVAL_MS);
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}
