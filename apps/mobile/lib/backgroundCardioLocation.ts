import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

export type BackgroundCardioRoutePoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number | null;
};

export const BACKGROUND_CARDIO_LOCATION_TASK =
  "mxrvs-background-cardio-location";

const BACKGROUND_CARDIO_ROUTE_KEY = "background_cardio_route_points";
const MAX_BACKGROUND_POINTS = 2000;

async function readBackgroundRoutePoints() {
  const raw = await AsyncStorage.getItem(BACKGROUND_CARDIO_ROUTE_KEY);
  return raw ? (JSON.parse(raw) as BackgroundCardioRoutePoint[]) : [];
}

async function appendBackgroundRoutePoints(points: BackgroundCardioRoutePoint[]) {
  if (points.length === 0) return;

  const existing = await readBackgroundRoutePoints();
  const merged = [...existing, ...points]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_BACKGROUND_POINTS);

  await AsyncStorage.setItem(
    BACKGROUND_CARDIO_ROUTE_KEY,
    JSON.stringify(merged),
  );
}

if (!TaskManager.isTaskDefined(BACKGROUND_CARDIO_LOCATION_TASK)) {
  TaskManager.defineTask<{
    locations?: Location.LocationObject[];
  }>(BACKGROUND_CARDIO_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.log("Background cardio location error:", error);
      return;
    }

    const points =
      data.locations?.map((location) => ({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
        accuracy: location.coords.accuracy ?? null,
      })) ?? [];

    await appendBackgroundRoutePoints(points);
  });
}

export async function resetBackgroundCardioRoutePoints() {
  await AsyncStorage.removeItem(BACKGROUND_CARDIO_ROUTE_KEY);
}

export async function drainBackgroundCardioRoutePoints() {
  const points = await readBackgroundRoutePoints();
  await resetBackgroundCardioRoutePoints();
  return points;
}

export async function startBackgroundCardioLocation() {
  try {
    const available = await Location.isBackgroundLocationAvailableAsync().catch(
      () => false,
    );

    if (!available) {
      return {
        started: false,
        reason: "Background location is not available in this build.",
      };
    }

    const existingPermission = await Location.getBackgroundPermissionsAsync();
    const permission = existingPermission.granted
      ? existingPermission
      : await Location.requestBackgroundPermissionsAsync();

    if (!permission.granted) {
      return {
        started: false,
        reason: "Background location permission was not granted.",
      };
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_CARDIO_LOCATION_TASK,
    ).catch(() => false);

    if (alreadyStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_CARDIO_LOCATION_TASK);
    }

    await resetBackgroundCardioRoutePoints();

    await Location.startLocationUpdatesAsync(BACKGROUND_CARDIO_LOCATION_TASK, {
      accuracy: Location.Accuracy.Highest,
      timeInterval: 1000,
      distanceInterval: 1,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.LocationActivityType.Fitness,
      foregroundService: {
        notificationTitle: "mxrvs cardio tracking",
        notificationBody: "Recording outdoor cardio distance.",
        notificationColor: "#16A34A",
        killServiceOnDestroy: false,
      },
    });

    return { started: true, reason: null };
  } catch (error) {
    console.log("Start background cardio location error:", error);

    return {
      started: false,
      reason: "Could not start background location tracking.",
    };
  }
}

export async function stopBackgroundCardioLocation() {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_CARDIO_LOCATION_TASK,
    ).catch(() => false);

    if (started) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_CARDIO_LOCATION_TASK);
    }
  } catch (error) {
    console.log("Stop background cardio location error:", error);
  }
}
