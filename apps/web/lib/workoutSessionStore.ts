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

const WORKOUT_TYPES: WorkoutType[] = [
  "push",
  "pull",
  "legs",
  "upper",
  "lower",
  "rest",
];

function isWorkoutType(value: unknown): value is WorkoutType {
  return WORKOUT_TYPES.includes(value as WorkoutType);
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonNegativeNumber(value: unknown) {
  return Math.max(0, finiteNumber(value));
}

export function readStoredWorkoutSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_WORKOUT_SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as Partial<StoredWorkoutSession> | null;
    if (
      !session ||
      typeof session !== "object" ||
      session.started !== true ||
      !isWorkoutType(session.selectedType)
    ) {
      return null;
    }

    const now = Date.now();
    const paused = session.paused === true;
    const elapsedUpdatedAt = finiteNumber(session.elapsedUpdatedAt);
    const restUpdatedAt = finiteNumber(session.restUpdatedAt);
    const elapsedDelta =
      !paused && elapsedUpdatedAt
        ? Math.max(0, Math.floor((now - elapsedUpdatedAt) / 1000))
        : 0;
    const restDelta =
      !paused && restUpdatedAt
        ? Math.max(0, Math.floor((now - restUpdatedAt) / 1000))
        : 0;

    return {
      selectedType: session.selectedType,
      selectedExerciseIds: Array.isArray(session.selectedExerciseIds)
        ? session.selectedExerciseIds.filter(
            (exerciseId): exerciseId is string => typeof exerciseId === "string",
          )
        : [],
      started: true,
      paused,
      elapsedSeconds: nonNegativeNumber(session.elapsedSeconds) + elapsedDelta,
      elapsedUpdatedAt,
      restRemaining: Math.max(
        0,
        nonNegativeNumber(session.restRemaining) - restDelta,
      ),
      restUpdatedAt,
      restExerciseId:
        typeof session.restExerciseId === "string"
          ? session.restExerciseId
          : null,
      sets: Array.isArray(session.sets) ? session.sets : [],
      notes: typeof session.notes === "string" ? session.notes : "",
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
