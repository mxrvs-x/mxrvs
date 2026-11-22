export type StrengthSetRecord = {
  reps: number | null | undefined;
  weight_kg: number | null | undefined;
};

export type CardioRecord = {
  distance_km: number | null | undefined;
  duration_seconds: number | null | undefined;
  steps: number | null | undefined;
};

function numberValue(value: number | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getStrengthPersonalRecords<T extends StrengthSetRecord>(
  sets: T[],
) {
  const validSets = sets.filter((set) => numberValue(set.reps) > 0);

  const weight = validSets.reduce<T | null>((best, set) => {
    if (!best) return set;
    const setWeight = numberValue(set.weight_kg);
    const bestWeight = numberValue(best.weight_kg);
    if (setWeight !== bestWeight) return setWeight > bestWeight ? set : best;
    return numberValue(set.reps) > numberValue(best.reps) ? set : best;
  }, null);

  return { weight };
}

export function getCardioPersonalRecords<T extends CardioRecord>(sessions: T[]) {
  const distance = sessions.reduce<T | null>((best, session) => {
    if (numberValue(session.distance_km) <= 0) return best;
    if (!best) return session;
    return numberValue(session.distance_km) > numberValue(best.distance_km)
      ? session
      : best;
  }, null);

  const duration = sessions.reduce<T | null>((best, session) => {
    if (numberValue(session.duration_seconds) <= 0) return best;
    if (!best) return session;
    return numberValue(session.duration_seconds) >
      numberValue(best.duration_seconds)
      ? session
      : best;
  }, null);

  const steps = sessions.reduce<T | null>((best, session) => {
    if (numberValue(session.steps) <= 0) return best;
    if (!best) return session;
    return numberValue(session.steps) > numberValue(best.steps) ? session : best;
  }, null);

  const pace = sessions.reduce<T | null>((best, session) => {
    const distanceKm = numberValue(session.distance_km);
    const durationSeconds = numberValue(session.duration_seconds);
    if (distanceKm <= 0 || durationSeconds <= 0) return best;
    if (!best) return session;
    const sessionPace = durationSeconds / distanceKm;
    const bestPace =
      numberValue(best.duration_seconds) / numberValue(best.distance_km);
    return sessionPace < bestPace ? session : best;
  }, null);

  return { distance, duration, steps, pace };
}
