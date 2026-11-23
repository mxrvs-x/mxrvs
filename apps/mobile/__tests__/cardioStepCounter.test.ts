jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

jest.mock("@/lib/androidStepTracker", () => ({
  getNativeAndroidStepSnapshot: jest.fn(),
  isNativeAndroidStepTrackerAvailable: jest.fn(),
  startNativeAndroidStepTracker: jest.fn(),
}));

jest.mock("expo-sensors", () => ({
  Pedometer: {
    isAvailableAsync: jest.fn(),
    watchStepCount: jest.fn(),
  },
}));

import {
  getNativeAndroidStepSnapshot,
  isNativeAndroidStepTrackerAvailable,
  startNativeAndroidStepTracker,
} from "../lib/androidStepTracker";
import { startCardioStepCounter } from "../lib/cardioStepCounter";
import { Pedometer } from "expo-sensors";

const mockGetSnapshot = getNativeAndroidStepSnapshot as jest.Mock;
const mockNativeAvailable = isNativeAndroidStepTrackerAvailable as jest.Mock;
const mockStartNative = startNativeAndroidStepTracker as jest.Mock;
const mockPedometerAvailable = Pedometer.isAvailableAsync as jest.Mock;
const mockWatchSteps = Pedometer.watchStepCount as jest.Mock;

const nativeSnapshot = (steps: number, date = "2026-11-23") => ({
  date,
  steps,
  movingSeconds: 0,
  distanceKm: 0,
  caloriesBurned: 0,
  weightKg: null,
  heightCm: null,
  trackingEnabled: true,
  inVehicle: false,
  vehicleActivityUpdatedAt: 0,
});

describe("cardio step counter", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reports only the native step delta after a cardio session starts", async () => {
    mockNativeAvailable.mockResolvedValue(true);
    mockStartNative.mockResolvedValue(nativeSnapshot(100));
    mockGetSnapshot.mockResolvedValue(nativeSnapshot(104));
    const onSteps = jest.fn();

    const stop = await startCardioStepCounter(onSteps);
    await jest.advanceTimersByTimeAsync(1_000);

    expect(onSteps).toHaveBeenCalledWith(4);
    stop();
    await jest.advanceTimersByTimeAsync(2_000);
    expect(mockGetSnapshot).toHaveBeenCalledTimes(1);
  });

  it("uses a new baseline after a day rollover or sensor reset", async () => {
    mockNativeAvailable.mockResolvedValue(true);
    mockStartNative.mockResolvedValue(nativeSnapshot(500, "2026-11-22"));
    mockGetSnapshot
      .mockResolvedValueOnce(nativeSnapshot(2, "2026-11-23"))
      .mockResolvedValueOnce(nativeSnapshot(5, "2026-11-23"));
    const onSteps = jest.fn();

    const stop = await startCardioStepCounter(onSteps);
    await jest.advanceTimersByTimeAsync(2_000);

    expect(onSteps).toHaveBeenCalledTimes(1);
    expect(onSteps).toHaveBeenCalledWith(3);
    stop();
  });

  it("falls back to Expo without counting Android's synthetic first update", async () => {
    mockNativeAvailable.mockResolvedValue(false);
    mockPedometerAvailable.mockResolvedValue(true);
    let listener: ((result: { steps: number }) => void) | undefined;
    const remove = jest.fn();
    mockWatchSteps.mockImplementation((nextListener) => {
      listener = nextListener;
      return { remove };
    });
    const onSteps = jest.fn();

    const stop = await startCardioStepCounter(onSteps);
    listener?.({ steps: 2 });
    listener?.({ steps: 5 });

    expect(onSteps.mock.calls).toEqual([[3]]);
    stop();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
