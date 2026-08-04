import {
  getCachedBodyStats,
  getCachedLatestBodyWeightLog,
} from "@/lib/offlineWeight";
import {
  getNativeAndroidStepSnapshot,
  hasNativeAndroidStepTracker,
  isNativeAndroidStepTrackerAvailable,
  setNativeAndroidBodyMetrics,
  startNativeAndroidStepTracker,
} from "@/lib/androidStepTracker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pedometer } from "expo-sensors";
import { Platform } from "react-native";

const DAILY_ACTIVITY_KEY = "daily_pedometer_activity_v1";
const DEFAULT_STRIDE_METERS = 0.762;
const WALKING_STRIDE_HEIGHT_RATIO = 0.415;
const ESTIMATED_STEPS_PER_MOVING_MINUTE = 100;
const WALKING_KCAL_PER_KG_KM = 0.5;

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
      Platform.OS === "ios" || nativeAndroidTrackerAvailable
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

  const weight = Number(weightLog?.weight_kg);
  const height = Number(bodyStats?.height_cm);
  const strideMeters =
    Number.isFinite(height) && height > 0
      ? (height / 100) * WALKING_STRIDE_HEIGHT_RATIO
      : DEFAULT_STRIDE_METERS;
  const safeSteps = Math.max(0, Math.floor(steps));
  const distanceKm = (safeSteps * strideMeters) / 1000;
  const weightKg = Number.isFinite(weight) && weight > 0 ? weight : null;

  snapshot = {
    date: dateKey(),
    steps: safeSteps,
    movingSeconds: Math.round(
      (safeSteps / ESTIMATED_STEPS_PER_MOVING_MINUTE) * 60,
    ),
    distanceKm,
    caloriesBurned: weightKg
      ? Math.round(weightKg * distanceKm * WALKING_KCAL_PER_KG_KM)
      : 0,
    weightKg,
    available,
    permissionGranted,
    trackingScope:
      Platform.OS === "ios" || nativeAndroidTrackerAvailable
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
    hasNativeAndroidStepTracker() &&
    (await isNativeAndroidStepTrackerAvailable());
  const available = nativeAndroidTrackerAvailable
    ? true
    : await Pedometer.isAvailableAsync().catch(() => false);
  const permission = await Pedometer.getPermissionsAsync().catch(() => null);
  const permissionGranted = Boolean(permission?.granted);
  const stored = await loadStoredSteps();

  if (!available || !permissionGranted) {
    return buildSnapshot({
      steps: stored?.steps ?? 0,
      available,
      permissionGranted,
    });
  }

  let steps = stored?.steps ?? 0;

  if (nativeAndroidTrackerAvailable) {
    const [weightLog, bodyStats] = await Promise.all([
      getCachedLatestBodyWeightLog(),
      getCachedBodyStats(),
    ]);
    const weight = Number(weightLog?.weight_kg);
    const height = Number(bodyStats?.height_cm);

    await setNativeAndroidBodyMetrics(
      Number.isFinite(weight) && weight > 0 ? weight : null,
      Number.isFinite(height) && height > 0 ? height : null,
    );
    const nativeSnapshot = await getNativeAndroidStepSnapshot();

    if (nativeSnapshot) {
      steps = nativeSnapshot.steps;
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
  const available = await Pedometer.isAvailableAsync().catch(() => false);
  if (!available) return refreshDailyActivity();

  const permission = await Pedometer.requestPermissionsAsync().catch(
    () => null,
  );

  if (permission?.granted) {
    await startDailyActivityTracking();
  }

  return refreshDailyActivity();
}

export async function startDailyActivityTracking() {
  await stopDailyActivityTracking();

  const current = await refreshDailyActivity();
  if (!current.available || !current.permissionGranted) return current;

  if (nativeAndroidTrackerAvailable) {
    await startNativeAndroidStepTracker();
    return refreshDailyActivity();
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
  pedometerSubscription?.remove();
  pedometerSubscription = null;
  lastRawSteps = null;
}
