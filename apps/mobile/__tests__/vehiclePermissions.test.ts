jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  Linking: { openSettings: jest.fn() },
  Platform: { OS: "android", Version: 35 },
  PermissionsAndroid: {
    PERMISSIONS: { ACTIVITY_RECOGNITION: "android.permission.ACTIVITY_RECOGNITION" },
    RESULTS: { GRANTED: "granted", DENIED: "denied" },
    request: jest.fn(),
  },
}));

jest.mock("@/lib/androidStepTracker", () => ({
  getNativeAndroidStepSnapshot: jest.fn(),
  isNativeAndroidStepTrackerAvailable: jest.fn(),
}));

jest.mock("@/lib/dailyActivity", () => ({
  startDailyActivityTracking: jest.fn(),
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
}));

jest.mock("expo-media-library/legacy", () => ({
  requestPermissionsAsync: jest.fn(),
}));

jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: jest.fn(),
}));

jest.mock("expo-sensors", () => ({
  Pedometer: {
    isAvailableAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
  },
}));

import {
  getNativeAndroidStepSnapshot,
  isNativeAndroidStepTrackerAvailable,
} from "../lib/androidStepTracker";
import {
  requestAllAppPermissions,
  requestFitnessPermissions,
} from "../lib/appPermissions";
import { startDailyActivityTracking } from "../lib/dailyActivity";
import {
  getVehicleActivitySnapshot,
  refreshVehicleActivity,
  subscribeVehicleActivity,
} from "../lib/vehicleActivity";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Notifications from "expo-notifications";
import { Pedometer } from "expo-sensors";
import { Alert, Linking, PermissionsAndroid } from "react-native";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const mockNativeSnapshot = getNativeAndroidStepSnapshot as jest.Mock;
const mockNativeAvailable = isNativeAndroidStepTrackerAvailable as jest.Mock;
const mockStartDailyActivity = startDailyActivityTracking as jest.Mock;
const mockLocationPermission =
  Location.requestForegroundPermissionsAsync as jest.Mock;
const mockBackgroundLocationPermission =
  Location.requestBackgroundPermissionsAsync as jest.Mock;
const mockNotificationPermission =
  Notifications.requestPermissionsAsync as jest.Mock;
const mockPhotosPermission = MediaLibrary.requestPermissionsAsync as jest.Mock;
const mockCameraPermission =
  ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const mockPedometerAvailable = Pedometer.isAvailableAsync as jest.Mock;
const mockActivityPermission = PermissionsAndroid.request as jest.Mock;
const mockAlert = Alert.alert as jest.Mock;
const mockOpenSettings = Linking.openSettings as jest.Mock;

describe("vehicle activity tracking", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockNativeSnapshot.mockResolvedValue({ inVehicle: false });
    await refreshVehicleActivity();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("updates subscribers only when vehicle state changes", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeVehicleActivity(listener);
    await refreshVehicleActivity();
    expect(listener).toHaveBeenLastCalledWith(false);

    mockNativeSnapshot.mockResolvedValue({ inVehicle: true });
    await expect(refreshVehicleActivity()).resolves.toBe(true);
    expect(listener).toHaveBeenLastCalledWith(true);
    expect(getVehicleActivitySnapshot()).toBe(true);

    await refreshVehicleActivity();
    expect(listener.mock.calls.filter(([value]) => value === true)).toHaveLength(1);
    unsubscribe();
  });

  it("falls back to not-in-vehicle when the native snapshot fails", async () => {
    mockNativeSnapshot.mockResolvedValueOnce({ inVehicle: true });
    await refreshVehicleActivity();
    mockNativeSnapshot.mockRejectedValueOnce(new Error("native unavailable"));

    await expect(refreshVehicleActivity()).resolves.toBe(false);
    expect(getVehicleActivitySnapshot()).toBe(false);
  });

  it("shares one active native refresh across concurrent callers", async () => {
    const snapshot = deferred<{ inVehicle: boolean }>();
    mockNativeSnapshot.mockReturnValue(snapshot.promise);

    const first = refreshVehicleActivity();
    const second = refreshVehicleActivity();
    snapshot.resolve({ inVehicle: true });

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(mockNativeSnapshot).toHaveBeenCalledTimes(1);
  });

  it("uses one poller and stops it after the final subscriber leaves", async () => {
    const firstListener = jest.fn();
    const secondListener = jest.fn();
    const unsubscribeFirst = subscribeVehicleActivity(firstListener);
    const unsubscribeSecond = subscribeVehicleActivity(secondListener);
    await refreshVehicleActivity();
    mockNativeSnapshot.mockClear();

    await jest.advanceTimersByTimeAsync(2_000);
    expect(mockNativeSnapshot).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    await jest.advanceTimersByTimeAsync(2_000);
    expect(mockNativeSnapshot).toHaveBeenCalledTimes(2);

    unsubscribeSecond();
    await jest.advanceTimersByTimeAsync(4_000);
    expect(mockNativeSnapshot).toHaveBeenCalledTimes(2);
  });
});

describe("fitness permission requests", () => {
  let consoleLog: jest.SpyInstance;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockLocationPermission.mockResolvedValue({ status: "granted" });
    mockBackgroundLocationPermission.mockResolvedValue({ granted: true });
    mockNotificationPermission.mockResolvedValue({ granted: true });
    mockPhotosPermission.mockResolvedValue({ granted: true });
    mockCameraPermission.mockResolvedValue({ granted: true });
    mockNativeAvailable.mockResolvedValue(true);
    mockPedometerAvailable.mockResolvedValue(true);
    mockActivityPermission.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    mockStartDailyActivity.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it("starts daily tracking when location and activity access are granted", async () => {
    await expect(requestFitnessPermissions()).resolves.toEqual({
      locationGranted: true,
      activityGranted: true,
      pedometerAvailable: true,
      allGranted: true,
    });
    expect(mockStartDailyActivity).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it("requests every app permission in the post-login flow", async () => {
    await expect(requestAllAppPermissions()).resolves.toEqual({
      activityGranted: true,
      locationGranted: true,
      backgroundLocationGranted: true,
      notificationsGranted: true,
      photosGranted: true,
      cameraGranted: true,
    });

    expect(mockActivityPermission).toHaveBeenCalledTimes(1);
    expect(mockLocationPermission).toHaveBeenCalledTimes(1);
    expect(mockBackgroundLocationPermission).toHaveBeenCalledTimes(1);
    expect(mockNotificationPermission).toHaveBeenCalledTimes(1);
    expect(mockPhotosPermission).toHaveBeenCalledWith(false, ["photo"]);
    expect(mockCameraPermission).toHaveBeenCalledTimes(1);
  });

  it("blocks cardio and shows guidance when location is denied", async () => {
    mockLocationPermission.mockResolvedValue({ status: "denied" });

    await expect(requestFitnessPermissions()).resolves.toMatchObject({
      locationGranted: false,
      activityGranted: true,
      allGranted: false,
    });
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it("blocks cardio when the pedometer is unavailable", async () => {
    mockNativeAvailable.mockResolvedValue(false);
    mockPedometerAvailable.mockResolvedValue(false);

    await expect(requestFitnessPermissions()).resolves.toEqual({
      locationGranted: true,
      activityGranted: false,
      pedometerAvailable: false,
      allGranted: false,
    });
    expect(mockActivityPermission).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it("does not start daily tracking when activity permission is denied", async () => {
    mockActivityPermission.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    await expect(requestFitnessPermissions()).resolves.toMatchObject({
      activityGranted: false,
      allGranted: false,
    });
    expect(mockStartDailyActivity).not.toHaveBeenCalled();
  });

  it("returns a safe denied result when a native permission call throws", async () => {
    mockLocationPermission.mockRejectedValue(new Error("native failure"));

    await expect(requestFitnessPermissions()).resolves.toEqual({
      locationGranted: false,
      activityGranted: false,
      pedometerAvailable: false,
      allGranted: false,
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Permission Request Error:",
      expect.any(Error),
    );
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it("keeps granted permissions when daily tracking startup fails", async () => {
    mockStartDailyActivity.mockRejectedValue(new Error("tracker failed"));

    await expect(requestFitnessPermissions()).resolves.toMatchObject({
      allGranted: true,
    });
    expect(consoleLog).toHaveBeenCalledWith(
      "Start daily activity tracking error:",
      expect.any(Error),
    );
  });

  it("opens system settings from the permission guidance", async () => {
    mockLocationPermission.mockResolvedValue({ status: "denied" });
    await requestFitnessPermissions();

    const buttons = mockAlert.mock.calls[0][2];
    buttons[1].onPress();
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });
});
