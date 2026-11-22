export const DEFAULT_STRIDE_METERS = 0.762;
export const WALKING_STRIDE_HEIGHT_RATIO = 0.415;
export const ESTIMATED_STEPS_PER_MOVING_MINUTE = 100;
export const WALKING_KCAL_PER_KG_KM = 0.5;

export type ActivityCalculationInput = {
  steps: number;
  heightCm?: number | null;
  weightKg?: number | null;
};

export type ActivityMetrics = {
  steps: number;
  movingSeconds: number;
  strideMeters: number;
  distanceKm: number;
  caloriesBurned: number;
  weightKg: number | null;
};

function positiveFiniteNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function calculateActivityMetrics({
  steps,
  heightCm,
  weightKg,
}: ActivityCalculationInput): ActivityMetrics {
  const safeSteps = Number.isFinite(steps)
    ? Math.max(0, Math.floor(steps))
    : 0;
  const safeHeightCm = positiveFiniteNumber(heightCm);
  const safeWeightKg = positiveFiniteNumber(weightKg);
  const strideMeters = safeHeightCm
    ? (safeHeightCm / 100) * WALKING_STRIDE_HEIGHT_RATIO
    : DEFAULT_STRIDE_METERS;
  const distanceKm = (safeSteps * strideMeters) / 1000;
  const movingSeconds = Math.round(
    (safeSteps / ESTIMATED_STEPS_PER_MOVING_MINUTE) * 60,
  );
  const caloriesBurned = safeWeightKg
    ? Math.round(safeWeightKg * distanceKm * WALKING_KCAL_PER_KG_KM)
    : 0;

  return {
    steps: safeSteps,
    movingSeconds,
    strideMeters,
    distanceKm,
    caloriesBurned,
    weightKg: safeWeightKg,
  };
}
