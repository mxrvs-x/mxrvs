export type CardioRoutePoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

export function calculateElapsedSeconds(
  session: {
    tracking: boolean;
    isPaused: boolean;
    startedAtMs: number | null;
    activeMs: number;
    seconds: number;
  },
  nowMs = Date.now(),
) {
  if (!session.tracking) return Math.max(0, Math.floor(session.seconds));
  if (session.isPaused || !session.startedAtMs) {
    return Math.max(0, Math.floor(session.activeMs / 1000));
  }
  return Math.max(
    0,
    Math.floor((session.activeMs + nowMs - session.startedAtMs) / 1000),
  );
}

export function calculateDistanceKm(
  a: CardioRoutePoint,
  b: CardioRoutePoint,
) {
  const earthRadiusKm = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function isGpsReliable(
  accuracyMeters: number | null,
  maxAccuracyMeters: number,
) {
  return (
    accuracyMeters !== null &&
    Number.isFinite(accuracyMeters) &&
    accuracyMeters > 0 &&
    accuracyMeters <= maxAccuracyMeters
  );
}

export function acceptedGpsDistanceKm({
  previous,
  current,
  accuracyMeters,
  maxAccuracyMeters,
  minSegmentKm = 0.001,
  maxSegmentKm,
}: {
  previous: CardioRoutePoint | null;
  current: CardioRoutePoint;
  accuracyMeters: number | null;
  maxAccuracyMeters: number;
  minSegmentKm?: number;
  maxSegmentKm: number;
}) {
  if (
    !previous ||
    current.timestamp <= previous.timestamp ||
    !isGpsReliable(accuracyMeters, maxAccuracyMeters)
  ) {
    return 0;
  }
  const distance = calculateDistanceKm(previous, current);
  return distance > minSegmentKm && distance < maxSegmentKm ? distance : 0;
}

export function estimateStepDistanceKm(
  steps: number,
  heightCm: number | null,
  strideHeightRatio: number,
) {
  if (
    !Number.isFinite(steps) ||
    steps <= 0 ||
    !heightCm ||
    heightCm <= 0 ||
    !Number.isFinite(strideHeightRatio) ||
    strideHeightRatio <= 0
  ) {
    return 0;
  }
  return (Math.floor(steps) * (heightCm / 100) * strideHeightRatio) / 1000;
}

export function calculateSpeedKmh(distanceKm: number, seconds: number) {
  if (distanceKm <= 0 || seconds <= 0) return 0;
  return distanceKm / (seconds / 3600);
}

export function calculatePaceMinutesPerKm(
  distanceKm: number,
  seconds: number,
) {
  if (distanceKm <= 0 || seconds <= 0) return null;
  return seconds / 60 / distanceKm;
}

export function estimateCardioCalories(
  weightKg: number,
  distanceKm: number,
  kcalPerKgKm: number,
) {
  if (weightKg <= 0 || distanceKm <= 0 || kcalPerKgKm <= 0) return 0;
  return Math.round(weightKg * distanceKm * kcalPerKgKm);
}
