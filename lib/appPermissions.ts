import * as Location from "expo-location";
import { Pedometer } from "expo-sensors";
import { Alert, Linking, Platform } from "react-native";

export async function requestFitnessPermissions() {
  const results = {
    locationGranted: false,
    activityGranted: false,
    pedometerAvailable: false,
    allGranted: false,
  };

  try {
    // 1. Location Permissions
    const locationPermission = await Location.requestForegroundPermissionsAsync();
    results.locationGranted = locationPermission.status === "granted";

    // 2. Pedometer Availability
    // We wrap this because it can throw if the native sensor bridge is missing
    const isAvailable = await Pedometer.isAvailableAsync().catch(() => false);
    results.pedometerAvailable = isAvailable;

    if (isAvailable) {
      // 3. Activity Permissions
      // On some Android versions, this returns immediately; on iOS, it shows a popup
      const activityPermission = await Pedometer.requestPermissionsAsync();
      results.activityGranted = activityPermission.granted || activityPermission.status === "granted";
    } else {
      // If pedometer isn't available (like on a simulator), 
      // decide if you want to block the run or just mark it false.
      results.activityGranted = false;
    }
  } catch (error) {
    console.error("Permission Request Error:", error);
    // Setting all to false if a native error occurs to prevent crashing the UI
    results.locationGranted = false;
    results.activityGranted = false;
  }

  results.allGranted = results.locationGranted && results.activityGranted;

  if (!results.allGranted) {
    Alert.alert(
      "Permissions Required",
      "To track your runs, this app needs Location and Physical Activity access. Please enable them in Settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  }

  return results;
}