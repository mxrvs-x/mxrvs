import {
  dedupeExercisesByMuscleGroup,
  formatMuscleGroup,
  formatWorkoutType,
  getWorkoutPlan,
  groupExercisesByMuscleGroup,
  isExerciseRecommendedForWorkout,
  isMuscleGroup,
  isWorkoutType,
  sortExercisesByMuscleGroup,
  type WorkoutExerciseMeta,
} from "../lib/workoutPlans";

const exercise = (
  overrides: Partial<WorkoutExerciseMeta>,
): WorkoutExerciseMeta => ({
  name: "Exercise",
  muscle_group: "chest",
  movement_type: null,
  ...overrides,
});

describe("workout plan validation and formatting", () => {
  it.each(["push", "pull", "legs", "upper", "lower", "rest"])(
    "accepts the %s workout type",
    (type) => {
      expect(isWorkoutType(type)).toBe(true);
    },
  );

  it.each([undefined, "cardio", "", ["push"]])(
    "rejects an invalid workout type: %p",
    (type) => {
      expect(isWorkoutType(type)).toBe(false);
    },
  );

  it("validates known muscle groups", () => {
    expect(isMuscleGroup("shoulders")).toBe(true);
    expect(isMuscleGroup("rear-delts")).toBe(false);
    expect(isMuscleGroup(null)).toBe(false);
  });

  it("returns and formats known plans", () => {
    expect(getWorkoutPlan("lower").label).toBe("Lower / Arms");
    expect(getWorkoutPlan("rest").label).toBe("Rest");
    expect(formatWorkoutType("pull")).toBe("Pull");
  });

  it("formats nullable and compound muscle-group names", () => {
    expect(formatMuscleGroup(null)).toBe("No muscle group");
    expect(formatMuscleGroup("rear_delts")).toBe("Rear Delts");
  });
});

describe("exercise recommendations", () => {
  it("matches the primary muscle groups for each split", () => {
    expect(
      isExerciseRecommendedForWorkout(
        exercise({ name: "Bench Press", muscle_group: "chest" }),
        "push",
      ),
    ).toBe(true);
    expect(
      isExerciseRecommendedForWorkout(
        exercise({ name: "Barbell Row", muscle_group: "back" }),
        "pull",
      ),
    ).toBe(true);
    expect(
      isExerciseRecommendedForWorkout(
        exercise({ name: "Squat", muscle_group: "legs" }),
        "legs",
      ),
    ).toBe(true);
  });

  it.each(["Rear Delt Raise", "Face Pull", "Reverse Pec Deck"])(
    "includes %s in pull workouts",
    (name) => {
      expect(
        isExerciseRecommendedForWorkout(
          exercise({ name, muscle_group: "shoulders" }),
          "pull",
        ),
      ).toBe(true);
    },
  );

  it("does not include unrelated shoulder exercises in pull workouts", () => {
    expect(
      isExerciseRecommendedForWorkout(
        exercise({ name: "Lateral Raise", muscle_group: "shoulders" }),
        "pull",
      ),
    ).toBe(false);
  });

  it("does not recommend exercises for rest days", () => {
    expect(
      isExerciseRecommendedForWorkout(
        exercise({ name: "Bench Press", muscle_group: "chest" }),
        "rest",
      ),
    ).toBe(false);
  });
});

describe("exercise collection helpers", () => {
  const exercises: WorkoutExerciseMeta[] = [
    exercise({ name: "Curl", muscle_group: "arms" }),
    exercise({ name: "Fly", muscle_group: "chest", is_compound: false }),
    exercise({ name: "Bench", muscle_group: "chest", is_compound: true }),
    exercise({ name: "Row", muscle_group: "back", is_compound: true }),
  ];

  it("sorts by muscle group, compound status, then name without mutating", () => {
    const original = [...exercises];
    const sorted = sortExercisesByMuscleGroup(exercises);

    expect(sorted.map((item) => item.name)).toEqual([
      "Bench",
      "Fly",
      "Row",
      "Curl",
    ]);
    expect(exercises).toEqual(original);
  });

  it("deduplicates normalized names within the same muscle group", () => {
    const result = dedupeExercisesByMuscleGroup([
      exercise({
        id: "preferred",
        name: " Bench Press ",
        muscle_group: "chest",
        movement_type: null,
      }),
      exercise({
        id: "duplicate",
        name: "bench press",
        muscle_group: "chest",
        movement_type: "push",
      }),
      exercise({
        id: "other-group",
        name: "Bench Press",
        muscle_group: "shoulders",
      }),
    ]);

    expect(result.map((item) => item.id)).toEqual([
      "preferred",
      "other-group",
    ]);
  });

  it("groups sorted exercises by muscle group", () => {
    const groups = groupExercisesByMuscleGroup(exercises);

    expect(groups.map(([group]) => group)).toEqual([
      "chest",
      "back",
      "arms",
    ]);
    expect(groups[0][1].map((item) => item.name)).toEqual(["Bench", "Fly"]);
  });
});
