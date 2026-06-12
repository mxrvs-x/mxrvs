export type WorkoutType = "push" | "pull" | "legs" | "upper" | "lower" | "rest";

export type MuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core";

export type WorkoutPlan = {
  day?: string;
  type: WorkoutType;
  label: string;
  emoji: string;
};

export type WorkoutExerciseMeta = {
  id?: string;
  name: string;
  muscle_group: string | null;
  movement_type: WorkoutType | null;
  is_compound?: boolean;
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
];

export const WORKOUT_PLANS: WorkoutPlan[] = [
  { type: "push", label: "Push", emoji: "P" },
  { type: "pull", label: "Pull", emoji: "P" },
  { type: "legs", label: "Legs", emoji: "L" },
  { type: "upper", label: "Upper", emoji: "U" },
  { type: "lower", label: "Lower / Arms", emoji: "LA" },
];

export const REST_PLAN: WorkoutPlan = {
  type: "rest",
  label: "Rest",
  emoji: "R",
};

export const WEEK_SPLIT: WorkoutPlan[] = [
  { ...REST_PLAN, day: "Sunday" },
  { ...WORKOUT_PLANS[0], day: "Monday" },
  { ...WORKOUT_PLANS[1], day: "Tuesday" },
  { ...WORKOUT_PLANS[2], day: "Wednesday" },
  { ...REST_PLAN, day: "Thursday" },
  { ...WORKOUT_PLANS[3], day: "Friday" },
  { ...WORKOUT_PLANS[4], day: "Saturday" },
];

export function getTodayWorkoutPlan() {
  return WEEK_SPLIT[new Date().getDay()];
}

export function isWorkoutType(value?: string | string[]): value is WorkoutType {
  return (
    value === "push" ||
    value === "pull" ||
    value === "legs" ||
    value === "upper" ||
    value === "lower" ||
    value === "rest"
  );
}

export function isMuscleGroup(value: unknown): value is MuscleGroup {
  return (
    typeof value === "string" && MUSCLE_GROUPS.includes(value as MuscleGroup)
  );
}

export function getWorkoutPlan(type: WorkoutType) {
  if (type === "rest") return REST_PLAN;
  return WORKOUT_PLANS.find((plan) => plan.type === type) || WORKOUT_PLANS[0];
}

export function formatWorkoutType(type: WorkoutType) {
  return getWorkoutPlan(type).label;
}

export function formatMuscleGroup(group: string | null) {
  if (!group) return "No muscle group";
  return group
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const SPLIT_MUSCLE_GROUPS: Record<Exclude<WorkoutType, "rest">, MuscleGroup[]> = {
  push: ["chest", "shoulders", "arms"],
  pull: ["back", "arms"],
  legs: ["legs", "core"],
  upper: ["chest", "back", "shoulders", "arms"],
  lower: ["legs", "shoulders", "arms", "core"],
};

function isRearDeltExercise(exercise: WorkoutExerciseMeta) {
  const name = exercise.name.trim().toLowerCase();

  return (
    exercise.muscle_group === "shoulders" &&
    (name.includes("rear delt") ||
      name.includes("rear delts") ||
      name.includes("rear deltoid") ||
      name.includes("face pull") ||
      name.includes("reverse fly") ||
      name.includes("reverse pec deck"))
  );
}

export function isExerciseRecommendedForWorkout(
  exercise: WorkoutExerciseMeta,
  type: WorkoutType,
) {
  if (type === "rest") return false;

  return (
    SPLIT_MUSCLE_GROUPS[type].includes(exercise.muscle_group as MuscleGroup) ||
    (type === "pull" && isRearDeltExercise(exercise))
  );
}

function getExercisePriority(exercise: WorkoutExerciseMeta) {
  if (!exercise.movement_type || exercise.movement_type === "rest") return 0;
  return 1;
}

function getMuscleGroupRank(group: string | null) {
  if (!group) return MUSCLE_GROUPS.length;
  const index = MUSCLE_GROUPS.indexOf(group as MuscleGroup);
  return index >= 0 ? index : MUSCLE_GROUPS.length;
}

export function sortExercisesByMuscleGroup<T extends WorkoutExerciseMeta>(
  exercises: T[],
) {
  return [...exercises].sort((a, b) => {
    const groupCompare =
      getMuscleGroupRank(a.muscle_group) - getMuscleGroupRank(b.muscle_group);
    if (groupCompare !== 0) return groupCompare;

    const compoundCompare =
      Number(Boolean(b.is_compound)) - Number(Boolean(a.is_compound));
    if (compoundCompare !== 0) return compoundCompare;

    return a.name.localeCompare(b.name);
  });
}

export function dedupeExercisesByMuscleGroup<T extends WorkoutExerciseMeta>(
  exercises: T[],
) {
  const byExercise = new Map<string, T>();

  exercises.forEach((exercise) => {
    const key = `${exercise.name.trim().toLowerCase()}|${
      exercise.muscle_group || "none"
    }`;
    const existing = byExercise.get(key);

    if (
      !existing ||
      getExercisePriority(exercise) < getExercisePriority(existing)
    ) {
      byExercise.set(key, exercise);
    }
  });

  return sortExercisesByMuscleGroup(Array.from(byExercise.values()));
}

export function groupExercisesByMuscleGroup<T extends WorkoutExerciseMeta>(
  exercises: T[],
) {
  const sections = new Map<string, T[]>();

  sortExercisesByMuscleGroup(exercises).forEach((exercise) => {
    const group = exercise.muscle_group || "other";
    sections.set(group, [...(sections.get(group) || []), exercise]);
  });

  return Array.from(sections.entries());
}
