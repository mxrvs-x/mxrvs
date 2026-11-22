import {
  acceptedGpsDistanceKm,
  calculateDistanceKm,
  calculateElapsedSeconds,
  calculatePaceMinutesPerKm,
  calculateSpeedKmh,
  estimateCardioCalories,
  estimateStepDistanceKm,
  isGpsReliable,
  type CardioRoutePoint,
} from "../lib/cardioTracking";

const point = (
  latitude: number,
  longitude: number,
  timestamp: number,
): CardioRoutePoint => ({ latitude, longitude, timestamp });

describe("cardio tracking calculations", () => {
  it("calculates active elapsed time and freezes paused sessions", () => {
    expect(
      calculateElapsedSeconds(
        {
          tracking: true,
          isPaused: false,
          startedAtMs: 10_000,
          activeMs: 5_000,
          seconds: 0,
        },
        20_500,
      ),
    ).toBe(15);
    expect(
      calculateElapsedSeconds({
        tracking: true,
        isPaused: true,
        startedAtMs: null,
        activeMs: 9_999,
        seconds: 0,
      }),
    ).toBe(9);
  });

  it("preserves a stopped session's recorded seconds", () => {
    expect(
      calculateElapsedSeconds({
        tracking: false,
        isPaused: false,
        startedAtMs: null,
        activeMs: 0,
        seconds: 42,
      }),
    ).toBe(42);
  });

  it("calculates geographic distance using the haversine formula", () => {
    const distance = calculateDistanceKm(
      point(14.5995, 120.9842, 1),
      point(14.6005, 120.9842, 2),
    );
    expect(distance).toBeGreaterThan(0.11);
    expect(distance).toBeLessThan(0.112);
  });

  it("validates GPS accuracy against the activity threshold", () => {
    expect(isGpsReliable(25, 25)).toBe(true);
    expect(isGpsReliable(30, 25)).toBe(false);
    expect(isGpsReliable(0, 25)).toBe(false);
    expect(isGpsReliable(null, 25)).toBe(false);
  });

  it("accepts realistic ordered GPS segments", () => {
    const previous = point(14.5995, 120.9842, 1_000);
    const current = point(14.5996, 120.9842, 2_000);
    expect(
      acceptedGpsDistanceKm({
        previous,
        current,
        accuracyMeters: 10,
        maxAccuracyMeters: 25,
        maxSegmentKm: 0.08,
      }),
    ).toBeGreaterThan(0);
  });

  it("rejects stale, inaccurate, tiny, and implausible GPS segments", () => {
    const previous = point(14.5995, 120.9842, 2_000);
    expect(
      acceptedGpsDistanceKm({
        previous,
        current: point(14.5996, 120.9842, 1_000),
        accuracyMeters: 10,
        maxAccuracyMeters: 25,
        maxSegmentKm: 0.08,
      }),
    ).toBe(0);
    expect(
      acceptedGpsDistanceKm({
        previous,
        current: point(14.5996, 120.9842, 3_000),
        accuracyMeters: 50,
        maxAccuracyMeters: 25,
        maxSegmentKm: 0.08,
      }),
    ).toBe(0);
    expect(
      acceptedGpsDistanceKm({
        previous,
        current: point(14.5995001, 120.9842, 3_000),
        accuracyMeters: 5,
        maxAccuracyMeters: 25,
        maxSegmentKm: 0.08,
      }),
    ).toBe(0);
    expect(
      acceptedGpsDistanceKm({
        previous,
        current: point(14.61, 120.9842, 3_000),
        accuracyMeters: 5,
        maxAccuracyMeters: 25,
        maxSegmentKm: 0.08,
      }),
    ).toBe(0);
  });

  it("estimates step distance for walking and running strides", () => {
    expect(estimateStepDistanceKm(1000, 170, 0.415)).toBeCloseTo(0.7055);
    expect(estimateStepDistanceKm(1000, 170, 0.65)).toBeCloseTo(1.105);
    expect(estimateStepDistanceKm(1000, null, 0.65)).toBe(0);
  });

  it("calculates pace, speed, and calories with safe zero handling", () => {
    expect(calculatePaceMinutesPerKm(5, 1500)).toBe(5);
    expect(calculatePaceMinutesPerKm(0, 1500)).toBeNull();
    expect(calculateSpeedKmh(5, 1500)).toBe(12);
    expect(calculateSpeedKmh(5, 0)).toBe(0);
    expect(estimateCardioCalories(70, 5, 1)).toBe(350);
    expect(estimateCardioCalories(0, 5, 1)).toBe(0);
  });
});
