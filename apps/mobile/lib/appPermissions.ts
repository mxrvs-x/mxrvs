import { startDailyActivityTracking } from "@/lib/dailyActivity";
import { isNativeAndroidStepTrackerAvailable } from "@/lib/androidStepTracker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Notifications from "expo-notifications";
import { Pedometer } from "expo-sensors";
import {
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
} from "react-native";

async function requestPhysicalActivityPermission() {
  if (Platform.OS === "android") {
    if (Number(Platform.Version) < 29) return true;

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  const permission = await Pedometer.requestPermissionsAsync();
  return permission.granted || permission.status === "granted";
}

export async function requestFitnessPermissions({
  showSettingsAlert = true,
}: {
  showSettingsAlert?: boolean;
} = {}) {
  const results = {
    locationGranted: false,
    activityGranted: false,
    pedometerAvailable: false,
    allGranted: false,
  };

  try {
    const locationPermission = await Location.requestForegroundPermissionsAsync();
    results.locationGranted = locationPermission.status === "granted";
    const nativeAndroidSensorAvailable =
      Platform.OS === "android" &&
      (await isNativeAndroidStepTrackerAvailable());
    results.pedometerAvailable =
      nativeAndroidSensorAvailable ||
      (await Pedometer.isAvailableAsync().catch(() => false));

    if (results.pedometerAvailable) {
      results.activityGranted = await requestPhysicalActivityPermission();

      if (results.activityGranted) {
        await startDailyActivityTracking().catch((error) => {
          console.log("Start daily activity tracking error:", error);
        });
      }
    }
  } catch (error) {
    console.error("Permission Request Error:", error);
  }

  results.allGranted = results.locationGranted && results.activityGranted;

  if (!results.allGranted && showSettingsAlert) {
    Alert.alert(
      "Permissions Required",
      "To count steps and track cardio, enable Location and Physical Activity access in Settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ],
    );
  }

  return results;
}

export type AppPermissionResults = {
  activityGranted: boolean;
  locationGranted: boolean;
  backgroundLocationGranted: boolean;
  notificationsGranted: boolean;
  photosGranted: boolean;
  cameraGranted: boolean;
};

export async function requestAllAppPermissions(): Promise<AppPermissionResults> {
  const fitness = await requestFitnessPermissions({ showSettingsAlert: false });
  const notificationPermission = await Notifications.requestPermissionsAsync()
    .catch(() => null);
  const photosPermission = await MediaLibrary.requestPermissionsAsync(
    false,
    ["photo"],
  ).catch(() => null);
  const cameraPermission = await ImagePicker.requestCameraPermissionsAsync()
    .catch(() => null);

  let backgroundLocationGranted = false;
  if (fitness.locationGranted) {
    const backgroundPermission = await Location.requestBackgroundPermissionsAsync()
      .catch(() => null);
    backgroundLocationGranted = Boolean(backgroundPermission?.granted);
  }

  return {
    activityGranted: fitness.activityGranted,
    locationGranted: fitness.locationGranted,
    backgroundLocationGranted,
    notificationsGranted: Boolean(notificationPermission?.granted),
    photosGranted: Boolean(photosPermission?.granted),
    cameraGranted: Boolean(cameraPermission?.granted),
  };
}
