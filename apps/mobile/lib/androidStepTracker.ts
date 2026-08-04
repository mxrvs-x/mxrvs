import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type NativeStepSnapshot = {
  date: string;
  steps: number;
  movingSeconds: number;
  distanceKm: number;
  caloriesBurned: number;
  weightKg: number | null;
  heightCm: number | null;
  trackingEnabled: boolean;
};

type MxrvsStepTrackerModule = {
  isAvailableAsync(): Promise<boolean>;
  getSnapshotAsync(): Promise<NativeStepSnapshot>;
  startAsync(): Promise<NativeStepSnapshot>;
  stopAsync(): Promise<NativeStepSnapshot>;
  setBodyMetricsAsync(
    weightKg: number | null,
    heightCm: number | null,
  ): Promise<NativeStepSnapshot>;
};

const nativeModule =
  Platform.OS === "android"
    ? requireOptionalNativeModule<MxrvsStepTrackerModule>("MxrvsStepTracker")
    : null;

export function hasNativeAndroidStepTracker() {
  return nativeModule !== null;
}

export async function isNativeAndroidStepTrackerAvailable() {
  return (await nativeModule?.isAvailableAsync().catch(() => false)) ?? false;
}

export async function getNativeAndroidStepSnapshot() {
  return nativeModule?.getSnapshotAsync() ?? null;
}

export async function startNativeAndroidStepTracker() {
  return nativeModule?.startAsync() ?? null;
}

export async function stopNativeAndroidStepTracker() {
  return nativeModule?.stopAsync() ?? null;
}

export async function setNativeAndroidBodyMetrics(
  weightKg: number | null,
  heightCm: number | null,
) {
  return nativeModule?.setBodyMetricsAsync(weightKg, heightCm) ?? null;
}
