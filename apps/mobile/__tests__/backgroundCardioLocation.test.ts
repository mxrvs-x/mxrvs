import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@/lib/vehicleActivity", () => ({
  refreshVehicleActivity: jest.fn(),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Highest: 6 },
  LocationActivityType: { Fitness: 3 },
  getBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  isBackgroundLocationAvailableAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
}));

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(() => false),
}));

import { refreshVehicleActivity } from "../lib/vehicleActivity";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import {
  BACKGROUND_CARDIO_LOCATION_TASK,
  drainBackgroundCardioRoutePoints,
  startBackgroundCardioLocation,
  stopBackgroundCardioLocation,
} from "../lib/backgroundCardioLocation";

const mockRefreshVehicleActivity = refreshVehicleActivity as jest.Mock;
const mockAvailable =
  Location.isBackgroundLocationAvailableAsync as jest.Mock;
const mockGetPermission = Location.getBackgroundPermissionsAsync as jest.Mock;
const mockRequestPermission =
  Location.requestBackgroundPermissionsAsync as jest.Mock;
const mockHasStarted = Location.hasStartedLocationUpdatesAsync as jest.Mock;
const mockStartUpdates = Location.startLocationUpdatesAsync as jest.Mock;
const mockStopUpdates = Location.stopLocationUpdatesAsync as jest.Mock;
const mockDefineTask = TaskManager.defineTask as jest.Mock;
const backgroundTask = mockDefineTask.mock.calls[0][1] as (event: {
  data: { locations?: Array<ReturnType<typeof location>> };
  error: Error | null;
}) => Promise<void>;

function location(timestamp: number, latitude = 14.5995, longitude = 120.9842) {
  return {
    timestamp,
    coords: {
      latitude,
      longitude,
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
  };
}

describe("background cardio location", () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

    mockRefreshVehicleActivity.mockResolvedValue(false);
    mockAvailable.mockResolvedValue(true);
    mockGetPermission.mockResolvedValue({ granted: true });
    mockRequestPermission.mockResolvedValue({ granted: true });
    mockHasStarted.mockResolvedValue(false);
    mockStartUpdates.mockResolvedValue(undefined);
    mockStopUpdates.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleLog.mockRestore();
  });

  it("registers the background task once", () => {
    expect(backgroundTask).toBeDefined();
  });

  it("ignores task errors without changing buffered points", async () => {
    await backgroundTask({
      data: { locations: [location(1)] },
      error: new Error("location failed"),
    });

    await expect(drainBackgroundCardioRoutePoints()).resolves.toEqual([]);
    expect(consoleLog).toHaveBeenCalledWith(
      "Background cardio location error:",
      expect.any(Error),
    );
  });

  it("suppresses route points while vehicle travel is detected", async () => {
    mockRefreshVehicleActivity.mockResolvedValue(true);

    await backgroundTask({
      data: { locations: [location(1)] },
      error: null,
    });

    await expect(drainBackgroundCardioRoutePoints()).resolves.toEqual([]);
  });

  it("sorts, deduplicates, and drains buffered route points", async () => {
    await backgroundTask({
      data: { locations: [location(2), location(1)] },
      error: null,
    });
    await backgroundTask({
      data: { locations: [location(2, 15, 121), location(3)] },
      error: null,
    });

    const points = await drainBackgroundCardioRoutePoints();
    expect(points.map((point) => point.timestamp)).toEqual([1, 2, 3]);
    expect(points[1]).toMatchObject({ latitude: 15, longitude: 121 });
    await expect(drainBackgroundCardioRoutePoints()).resolves.toEqual([]);
  });

  it("preserves points from overlapping background callbacks", async () => {
    await Promise.all([
      backgroundTask({ data: { locations: [location(1)] }, error: null }),
      backgroundTask({ data: { locations: [location(2)] }, error: null }),
    ]);

    await expect(drainBackgroundCardioRoutePoints()).resolves.toEqual([
      expect.objectContaining({ timestamp: 1 }),
      expect.objectContaining({ timestamp: 2 }),
    ]);
  });

  it("keeps only the newest 2000 buffered points", async () => {
    await backgroundTask({
      data: {
        locations: Array.from({ length: 2005 }, (_, index) => location(index)),
      },
      error: null,
    });

    const points = await drainBackgroundCardioRoutePoints();
    expect(points).toHaveLength(2000);
    expect(points[0].timestamp).toBe(5);
    expect(points[1999].timestamp).toBe(2004);
  });

  it("reports when background location is unavailable", async () => {
    mockAvailable.mockResolvedValue(false);

    await expect(startBackgroundCardioLocation()).resolves.toEqual({
      started: false,
      reason: "Background location is not available in this build.",
    });
    expect(mockGetPermission).not.toHaveBeenCalled();
    expect(mockStartUpdates).not.toHaveBeenCalled();
  });

  it("requests permission and reports when it is denied", async () => {
    mockGetPermission.mockResolvedValue({ granted: false });
    mockRequestPermission.mockResolvedValue({ granted: false });

    await expect(startBackgroundCardioLocation()).resolves.toEqual({
      started: false,
      reason: "Background location permission was not granted.",
    });
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockStartUpdates).not.toHaveBeenCalled();
  });

  it("restarts an existing tracker and clears stale route points", async () => {
    await backgroundTask({
      data: { locations: [location(1)] },
      error: null,
    });
    mockHasStarted.mockResolvedValue(true);

    await expect(startBackgroundCardioLocation()).resolves.toEqual({
      started: true,
      reason: null,
    });
    expect(mockStopUpdates).toHaveBeenCalledWith(
      BACKGROUND_CARDIO_LOCATION_TASK,
    );
    expect(mockStartUpdates).toHaveBeenCalledWith(
      BACKGROUND_CARDIO_LOCATION_TASK,
      expect.objectContaining({
        accuracy: Location.Accuracy.Highest,
        timeInterval: 1000,
        distanceInterval: 1,
        foregroundService: expect.objectContaining({
          notificationTitle: "mxrvs cardio tracking",
        }),
      }),
    );
    await expect(drainBackgroundCardioRoutePoints()).resolves.toEqual([]);
  });

  it("returns a safe result when tracker startup fails", async () => {
    mockStartUpdates.mockRejectedValue(new Error("native failure"));

    await expect(startBackgroundCardioLocation()).resolves.toEqual({
      started: false,
      reason: "Could not start background location tracking.",
    });
    expect(consoleLog).toHaveBeenCalledWith(
      "Start background cardio location error:",
      expect.any(Error),
    );
  });

  it("stops location updates only when the tracker is active", async () => {
    mockHasStarted.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await stopBackgroundCardioLocation();
    expect(mockStopUpdates).not.toHaveBeenCalled();

    await stopBackgroundCardioLocation();
    expect(mockStopUpdates).toHaveBeenCalledWith(
      BACKGROUND_CARDIO_LOCATION_TASK,
    );
  });

  it("handles tracker shutdown failures without rejecting", async () => {
    mockHasStarted.mockResolvedValue(true);
    mockStopUpdates.mockRejectedValue(new Error("stop failed"));

    await expect(stopBackgroundCardioLocation()).resolves.toBeUndefined();
    expect(consoleLog).toHaveBeenCalledWith(
      "Stop background cardio location error:",
      expect.any(Error),
    );
  });
});
