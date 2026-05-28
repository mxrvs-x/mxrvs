import type { WorkoutSet, WorkoutType } from "@/app/components/shared";

export const ACTIVE_WORKOUT_SESSION_KEY = "mxrvs-web-active-workout-session";

export type StoredWorkoutSession = {
  selectedType: WorkoutType;
  selectedExerciseIds: string[];
  started: boolean;
  paused: boolean;
  elapsedSeconds: number;
  elapsedUpdatedAt: number;
  restRemaining: number;
  restUpdatedAt: number;
  restExerciseId: string | null;
  sets: WorkoutSet[];
  notes: string;
};

export function readStoredWorkoutSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_WORKOUT_SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as StoredWorkoutSession;
    if (!session.started || !session.selectedType) return null;

    const now = Date.now();
    const elapsedDelta =
      !session.paused && session.elapsedUpdatedAt
        ? Math.max(0, Math.floor((now - session.elapsedUpdatedAt) / 1000))
        : 0;
    const restDelta =
      !session.paused && session.restUpdatedAt
        ? Math.max(0, Math.floor((now - session.restUpdatedAt) / 1000))
        : 0;

    return {
      ...session,
      elapsedSeconds: Math.max(0, Number(session.elapsedSeconds || 0) + elapsedDelta),
      restRemaining: Math.max(0, Number(session.restRemaining || 0) - restDelta),
      selectedExerciseIds: Array.isArray(session.selectedExerciseIds)
        ? session.selectedExerciseIds
        : [],
      sets: Array.isArray(session.sets) ? session.sets : [],
      notes: session.notes || "",
    };
  } catch {
    return null;
  }
}

export function writeStoredWorkoutSession(session: StoredWorkoutSession) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    ACTIVE_WORKOUT_SESSION_KEY,
    JSON.stringify(session),
  );
}

export function clearStoredWorkoutSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_WORKOUT_SESSION_KEY);
}

export function hasActiveStoredWorkoutSession() {
  return Boolean(readStoredWorkoutSession());
}
