import {
  DEFAULT_STRIDE_METERS,
  ESTIMATED_STEPS_PER_MOVING_MINUTE,
  WALKING_KCAL_PER_KG_KM,
  WALKING_STRIDE_HEIGHT_RATIO,
  calculateActivityMetrics,
} from "../lib/activityCalculations";

describe("calculateActivityMetrics", () => {
  it("uses the default stride when height is unavailable", () => {
    const metrics = calculateActivityMetrics({ steps: 1_000 });

    expect(metrics.steps).toBe(1_000);
    expect(metrics.strideMeters).toBe(DEFAULT_STRIDE_METERS);
    expect(metrics.distanceKm).toBeCloseTo(0.762, 10);
    expect(metrics.movingSeconds).toBe(600);
    expect(metrics.caloriesBurned).toBe(0);
    expect(metrics.weightKg).toBeNull();
  });

  it("uses height and weight for distance and calorie estimates", () => {
    const metrics = calculateActivityMetrics({
      steps: 10_000,
      heightCm: 170,
      weightKg: 70,
    });

    const expectedStride = 1.7 * WALKING_STRIDE_HEIGHT_RATIO;
    const expectedDistance = (10_000 * expectedStride) / 1_000;
    const expectedCalories = Math.round(
      70 * expectedDistance * WALKING_KCAL_PER_KG_KM,
    );

    expect(metrics.strideMeters).toBeCloseTo(expectedStride, 10);
    expect(metrics.distanceKm).toBeCloseTo(expectedDistance, 10);
    expect(metrics.movingSeconds).toBe(
      Math.round((10_000 / ESTIMATED_STEPS_PER_MOVING_MINUTE) * 60),
    );
    expect(metrics.caloriesBurned).toBe(expectedCalories);
    expect(metrics.weightKg).toBe(70);
  });

  it("floors fractional steps", () => {
    expect(calculateActivityMetrics({ steps: 100.9 }).steps).toBe(100);
  });

  it.each([-10, Number.NaN, Number.POSITIVE_INFINITY])(
    "normalizes invalid steps %p to zero",
    (steps) => {
      expect(calculateActivityMetrics({ steps })).toMatchObject({
        steps: 0,
        movingSeconds: 0,
        distanceKm: 0,
        caloriesBurned: 0,
      });
    },
  );

  it.each([0, -170, Number.NaN, Number.POSITIVE_INFINITY])(
    "uses the default stride for invalid height %p",
    (heightCm) => {
      expect(
        calculateActivityMetrics({ steps: 1_000, heightCm }).strideMeters,
      ).toBe(DEFAULT_STRIDE_METERS);
    },
  );

  it.each([0, -70, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not calculate calories for invalid weight %p",
    (weightKg) => {
      expect(
        calculateActivityMetrics({ steps: 1_000, weightKg }),
      ).toMatchObject({
        caloriesBurned: 0,
        weightKg: null,
      });
    },
  );
});
