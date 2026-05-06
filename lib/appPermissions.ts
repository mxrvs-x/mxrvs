import * as Location from "expo-location";
import { Pedometer } from "expo-sensors";
import { Alert, Linking } from "react-native";

export async function requestFitnessPermissions() {
  const results = {
    locationGranted: false,
    activityGranted: false,
    pedometerAvailable: false,
    allGranted: false,
  };

  const locationPermission = await Location.requestForegroundPermissionsAsync();

  results.locationGranted = locationPermission.status === "granted";

  const pedometerAvailable = await Pedometer.isAvailableAsync();
  results.pedometerAvailable = pedometerAvailable;

  if (pedometerAvailable) {
    const activityPermission = await Pedometer.requestPermissionsAsync();
    results.activityGranted = activityPermission.status === "granted";
  }

  results.allGranted =
    results.locationGranted &&
    results.activityGranted &&
    results.pedometerAvailable;

  if (!results.allGranted) {
    Alert.alert(
      "Permissions Required",
      "Please allow Location and Physical Activity permissions in your phone settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => Linking.openSettings(),
        },
      ],
    );
  }

  return results;
}
