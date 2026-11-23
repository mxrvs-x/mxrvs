import {
  getCachedBodyStats,
  getCachedLatestBodyWeightLog,
  loadLatestBodyWeightLog,
} from "@/lib/offlineWeight";
import {
  getNativeAndroidStepSnapshot,
  hasNativeAndroidActivityPermission,
  hasNativeAndroidStepTracker,
  isNativeAndroidStepTrackerAvailable,
  setNativeAndroidBodyMetrics,
  startNativeAndroidStepTracker,
} from "@/lib/androidStepTracker";
import { calculateActivityMetrics } from "@/lib/activityCalculations";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pedometer } from "expo-sensors";
import { PermissionsAndroid, Platform } from "react-native";

const DAILY_ACTIVITY_KEY = "daily_pedometer_activity_v1";

export type DailyActivity = {
  date: string;
  steps: number;
  movingSeconds: number;
  distanceKm: number;
  caloriesBurned: number;
  weightKg: number | null;
  available: boolean;
  permissionGranted: boolean;
  trackingScope: "all-day" | "while-app-running";
  updatedAt: string;
};

type StoredDailySteps = {
  date: string;
  steps: number;
  updatedAt: string;
};

const listeners = new Set<() => void>();
let pedometerSubscription: Pedometer.Subscription | null = null;
let lastRawSteps: number | null = null;
let snapshot: DailyActivity = emptySnapshot();
let stepUpdatePromise = Promise.resolve();
let nativeAndroidTrackerAvailable = false;
let nativeAndroidTrackerRunning = false;
let nativeAndroidTrackerFailed = false;
let trackingGeneration = 0;

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function emptySnapshot(): DailyActivity {
  return {
    date: dateKey(),
    steps: 0,
    movingSeconds: 0,
    distanceKm: 0,
    caloriesBurned: 0,
    weightKg: null,
    available: false,
    permissionGranted: false,
    trackingScope:
      Platform.OS === "ios" || nativeAndroidTrackerRunning
        ? "all-day"
        : "while-app-running",
    updatedAt: new Date().toISOString(),
  };
}

async function loadStoredSteps() {
  const raw = await AsyncStorage.getItem(DAILY_ACTIVITY_KEY);
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as StoredDailySteps;
    return stored.date === dateKey() ? stored : null;
  } catch {
    return null;
  }
}

async function saveStoredSteps(steps: number) {
  const stored: StoredDailySteps = {
    date: dateKey(),
    steps: Math.max(0, Math.floor(steps)),
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(DAILY_ACTIVITY_KEY, JSON.stringify(stored));
}

async function buildSnapshot({
  steps,
  available,
  permissionGranted,
}: {
  steps: number;
  available: boolean;
  permissionGranted: boolean;
}) {
  const [weightLog, bodyStats] = await Promise.all([
    getCachedLatestBodyWeightLog(),
    getCachedBodyStats(),
  ]);

  const metrics = calculateActivityMetrics({
    steps,
    heightCm: Number(bodyStats?.height_cm),
    weightKg: Number(weightLog?.weight_kg),
  });

  snapshot = {
    date: dateKey(),
    steps: metrics.steps,
    movingSeconds: metrics.movingSeconds,
    distanceKm: metrics.distanceKm,
    caloriesBurned: metrics.caloriesBurned,
    weightKg: metrics.weightKg,
    available,
    permissionGranted,
    trackingScope:
      Platform.OS === "ios" || nativeAndroidTrackerRunning
        ? "all-day"
        : "while-app-running",
    updatedAt: new Date().toISOString(),
  };

  listeners.forEach((listener) => listener());
  return snapshot;
}

export function getDailyActivitySnapshot() {
  return snapshot;
}

export function subscribeDailyActivity(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshDailyActivity() {
  nativeAndroidTrackerAvailable =
    Platform.OS === "android" &&
    !nativeAndroidTrackerFailed &&
    hasNativeAndroidStepTracker() &&
    (await isNativeAndroidStepTrackerAvailable());
  nativeAndroidTrackerRunning = false;
  const available = nativeAndroidTrackerAvailable
    ? true
    : await Pedometer.isAvailableAsync().catch(() => false);
  const permissionGranted = nativeAndroidTrackerAvailable
    ? await hasNativeAndroidActivityPermission()
    : Boolean(
        (await Pedometer.getPermissionsAsync().catch(() => null))?.granted,
      );
  const stored = await loadStoredSteps();

  // The Android widget cannot query Supabase itself. Refresh the latest
  // body_weight_logs row while JS is active, then copy it into native storage
  // so calorie calculations continue after the app goes into the background.
  const [weightLog, bodyStats] = await Promise.all([
    loadLatestBodyWeightLog(),
    getCachedBodyStats(),
  ]);
  const weight = Number(weightLog?.weight_kg);
  const height = Number(bodyStats?.height_cm);

  if (nativeAndroidTrackerAvailable) {
    await setNativeAndroidBodyMetrics(
      Number.isFinite(weight) && weight > 0 ? weight : null,
      Number.isFinite(height) && height > 0 ? height : null,
    ).catch(() => null);
  }

  if (!available || !permissionGranted) {
    return buildSnapshot({
      steps: stored?.steps ?? 0,
      available,
      permissionGranted,
    });
  }

  let steps = stored?.steps ?? 0;

  if (nativeAndroidTrackerAvailable) {
    const nativeSnapshot = await getNativeAndroidStepSnapshot().catch(
      () => null,
    );

    if (nativeSnapshot) {
      steps = nativeSnapshot.steps;
      nativeAndroidTrackerRunning = nativeSnapshot.trackingEnabled;
      await saveStoredSteps(steps);
    }
  } else if (Platform.OS === "ios") {
    const result = await Pedometer.getStepCountAsync(
      startOfToday(),
      new Date(),
    ).catch(() => null);

    if (result) {
      steps = result.steps;
      await saveStoredSteps(steps);
    }
  }

  return buildSnapshot({ steps, available, permissionGranted });
}

export async function requestDailyActivityPermission() {
  const nativeAvailable =
    Platform.OS === "android" &&
    hasNativeAndroidStepTracker() &&
    (await isNativeAndroidStepTrackerAvailable());
  const available =
    nativeAvailable || (await Pedometer.isAvailableAsync().catch(() => false));
  if (!available) return refreshDailyActivity();

  const permissionGranted =
    Platform.OS === "android"
      ? Number(Platform.Version) < 29 ||
        (await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        ).catch(() => PermissionsAndroid.RESULTS.DENIED)) ===
          PermissionsAndroid.RESULTS.GRANTED
      : Boolean(
          (await Pedometer.requestPermissionsAsync().catch(() => null))
            ?.granted,
        );

  if (permissionGranted) {
    await startDailyActivityTracking();
  }

  return refreshDailyActivity();
}

export async function startDailyActivityTracking() {
  const generation = ++trackingGeneration;
  removePedometerSubscription();

  const current = await refreshDailyActivity();
  if (generation !== trackingGeneration) return current;
  if (!current.available || !current.permissionGranted) return current;

  if (nativeAndroidTrackerAvailable) {
    const nativeSnapshot = await startNativeAndroidStepTracker().catch(
      () => null,
    );
    if (generation !== trackingGeneration) return current;

    nativeAndroidTrackerRunning = Boolean(nativeSnapshot?.trackingEnabled);
    if (nativeAndroidTrackerRunning) return refreshDailyActivity();

    // Keep the current session useful if the custom service cannot start.
    // Expo's listener is foreground-only on Android, which is reflected in
    // trackingScope below.
    nativeAndroidTrackerFailed = true;
    nativeAndroidTrackerAvailable = false;
  }

  lastRawSteps = null;
  pedometerSubscription = Pedometer.watchStepCount((result) => {
    const rawSteps = Math.max(0, Math.floor(result.steps));

    // Android's Expo bridge reports an artificial value of 1 when the native
    // step-counter listener is first registered. Establish a baseline first so
    // opening/resuming the app never creates a step.
    if (lastRawSteps === null) {
      lastRawSteps = rawSteps;
      return;
    }

    const delta = Math.max(0, rawSteps - lastRawSteps);
    lastRawSteps = rawSteps;

    if (delta === 0) return;

    stepUpdatePromise = stepUpdatePromise
      .then(async () => {
        const stored = await loadStoredSteps();
        const currentSnapshotSteps =
          snapshot.date === dateKey() ? snapshot.steps : 0;
        const nextSteps =
          Platform.OS === "ios"
            ? Math.max(currentSnapshotSteps, (stored?.steps ?? 0) + delta)
            : (stored?.steps ?? 0) + delta;

        await saveStoredSteps(nextSteps);
        await buildSnapshot({
          steps: nextSteps,
          available: true,
          permissionGranted: true,
        });
      })
      .catch((error) => {
        console.log("Update daily steps error:", error);
      });
  });

  return current;
}

export async function stopDailyActivityTracking() {
  trackingGeneration += 1;
  removePedometerSubscription();
}

function removePedometerSubscription() {
  pedometerSubscription?.remove();
  pedometerSubscription = null;
  lastRawSteps = null;
}
