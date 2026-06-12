"use client";

import { supabase, supabaseConfigError } from "./supabase";
import type {
  BodyWeightLog,
  CardioSession,
  CreatineLog,
  Exercise,
  MuscleGroup,
  ProfileState,
  Workout,
  WorkoutSet,
  WorkoutType,
} from "@/app/components/shared";

export type SyncState = "supabase" | "local";

const MUSCLE_GROUP_ORDER: MuscleGroup[] = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
];

type DbWorkoutSet = WorkoutSet & {
  workout_id: string;
};

type BodyStats = {
  id: string;
  height_cm: number | null;
};

function muscleGroupRank(group: MuscleGroup) {
  const index = MUSCLE_GROUP_ORDER.indexOf(group);
  return index >= 0 ? index : MUSCLE_GROUP_ORDER.length;
}

export function dedupeWebExercises(exercises: Exercise[]) {
  const byNameAndGroup = new Map<string, Exercise>();

  exercises.forEach((exercise) => {
    if (!exercise.muscle_group) return;

    const normalizedName = exercise.name.trim().toLowerCase();
    const key = `${normalizedName}|${exercise.muscle_group}`;

    if (!byNameAndGroup.has(key)) {
      byNameAndGroup.set(key, {
        ...exercise,
        name: exercise.name.trim(),
        muscle_group: exercise.muscle_group as MuscleGroup,
      });
    }
  });

  return Array.from(byNameAndGroup.values()).sort((a, b) => {
    const groupCompare = muscleGroupRank(a.muscle_group) - muscleGroupRank(b.muscle_group);
    if (groupCompare !== 0) return groupCompare;

    const compoundCompare = Number(b.is_compound) - Number(a.is_compound);
    if (compoundCompare !== 0) return compoundCompare;

    return a.name.localeCompare(b.name);
  });
}

export async function getWebUser() {
  if (supabaseConfigError) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function signInWeb(email: string, password: string) {
  if (supabaseConfigError) {
    return { error: supabaseConfigError };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  return { error: error?.message || null };
}

export async function signOutWeb() {
  await supabase.auth.signOut();
}

export async function loadWebWorkouts() {
  const user = await getWebUser();
  if (!user) return null;

  const [{ data: exercises }, { data: workouts, error: workoutError }] =
    await Promise.all([
      supabase
        .from("exercises")
        .select("id, name, muscle_group, is_compound")
        .eq("user_id", user.id)
        .order("muscle_group", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("workouts")
        .select("id, workout_date, workout_type, notes, duration_minutes, created_at")
        .eq("user_id", user.id)
        .order("workout_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  if (workoutError) return null;

  const workoutRows = (workouts || []) as Array<Omit<Workout, "sets">>;
  const workoutIds = workoutRows.map((workout) => workout.id);
  const exerciseRows = dedupeWebExercises((exercises || []) as Exercise[]);
  const exerciseMap = new Map(exerciseRows.map((exercise) => [exercise.id, exercise]));

  let setRows: DbWorkoutSet[] = [];
  if (workoutIds.length > 0) {
    const { data } = await supabase
      .from("workout_sets")
      .select("id, workout_id, exercise_id, set_number, reps, weight_kg, rest_seconds")
      .in("workout_id", workoutIds);

    setRows = (data || []) as DbWorkoutSet[];
  }

  const mappedWorkouts: Workout[] = workoutRows.map((workout) => ({
    ...workout,
    workout_type: workout.workout_type as WorkoutType,
    notes: workout.notes || "",
    duration_minutes: workout.duration_minutes || 0,
    sets: setRows
      .filter((set) => set.workout_id === workout.id)
      .sort((a, b) => a.exercise_id.localeCompare(b.exercise_id) || a.set_number - b.set_number)
      .map((set) => ({
        id: set.id,
        exercise_id: set.exercise_id,
        exercise_name: exerciseMap.get(set.exercise_id)?.name || "Exercise",
        set_number: set.set_number,
        reps: Number(set.reps) || 0,
        weight_kg: Number(set.weight_kg) || 0,
        rest_seconds: Number(set.rest_seconds) || 0,
      })),
  }));

  return {
    exercises: exerciseRows,
    workouts: mappedWorkouts,
  };
}

export async function saveWebExercise(form: {
  id?: string;
  name: string;
  muscle_group: MuscleGroup;
  is_compound: boolean;
}) {
  const user = await getWebUser();
  if (!user) return null;

  const payload = {
    user_id: user.id,
    name: form.name.trim(),
    muscle_group: form.muscle_group,
    movement_type: null,
    is_compound: form.is_compound,
  };

  const query = form.id
    ? supabase
        .from("exercises")
        .update(payload)
        .eq("id", form.id)
        .eq("user_id", user.id)
        .select("id, name, muscle_group, is_compound")
    : supabase
        .from("exercises")
        .insert(payload)
        .select("id, name, muscle_group, is_compound");

  const { data, error } = await query.single();
  if (error || !data) return null;

  return {
    ...(data as Exercise),
    muscle_group: data.muscle_group as MuscleGroup,
  };
}

export async function deleteWebExercise(exerciseId: string) {
  const user = await getWebUser();
  if (!user) return false;

  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", exerciseId)
    .eq("user_id", user.id);

  return !error;
}

export async function saveWebWorkout(workout: Workout) {
  const user = await getWebUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("workouts")
    .insert({
      user_id: user.id,
      workout_date: workout.workout_date,
      workout_type: workout.workout_type,
      notes: workout.notes.trim() || null,
      duration_minutes: workout.duration_minutes,
    })
    .select("id, workout_date, workout_type, notes, duration_minutes, created_at")
    .single();

  if (error || !data) return null;

  const setRows = workout.sets.map((set) => ({
    user_id: user.id,
    workout_id: data.id,
    exercise_id: set.exercise_id,
    set_number: set.set_number,
    reps: set.reps,
    weight_kg: set.weight_kg,
    rest_seconds: set.rest_seconds || null,
  }));

  if (setRows.length > 0) {
    const { error: setsError } = await supabase.from("workout_sets").insert(setRows);
    if (setsError) {
      await supabase.from("workouts").delete().eq("id", data.id);
      return null;
    }
  }

  return {
    ...workout,
    id: data.id,
    created_at: data.created_at,
    notes: data.notes || "",
  };
}

export async function loadWebCardio() {
  const user = await getWebUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("cardio_sessions")
    .select("id, cardio_type, cardio_source, session_date, distance_km, duration_seconds, calories_burned, steps, notes")
    .eq("user_id", user.id)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return null;
  return (data || []).map((session) => ({
    ...(session as CardioSession),
    calories_burned: Number(session.calories_burned) || 0,
    steps: Number(session.steps) || 0,
    notes: session.notes || "",
  }));
}

export async function loadWebCreatine() {
  const user = await getWebUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("creatine_logs")
    .select("id, date, grams, logged_at")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("logged_at", { ascending: false });

  if (error) return null;

  return (data || []).map((log) => ({
    id: log.id,
    date: log.date,
    grams: Number(log.grams) || 5,
    created_at: log.logged_at,
  })) as CreatineLog[];
}

export async function logWebCreatine(date: string) {
  const user = await getWebUser();
  if (!user) return null;

  const payload = {
    user_id: user.id,
    date,
    logged_at: new Date().toISOString(),
    grams: 5,
    notes: null,
  };

  const { data, error } = await supabase
    .from("creatine_logs")
    .upsert(payload, { onConflict: "user_id,date" })
    .select("id, date, grams, logged_at")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    date: data.date,
    grams: Number(data.grams) || 5,
    created_at: data.logged_at,
  } as CreatineLog;
}

export async function deleteWebCreatine(date: string) {
  const user = await getWebUser();
  if (!user) return false;

  const { error } = await supabase
    .from("creatine_logs")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date);

  return !error;
}

export async function loadWebProfile(fallback: ProfileState) {
  const user = await getWebUser();
  if (!user) return null;

  const [{ data: stats }, { data: logs }] = await Promise.all([
    supabase
      .from("body_stats")
      .select("id, height_cm")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("body_weight_logs")
      .select("id, date, logged_at, weight_kg, body_fat_percent")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  return {
    email: user.email || fallback.email,
    display_name:
      String(user.user_metadata?.display_name || user.user_metadata?.full_name || "") ||
      fallback.display_name,
    height_cm: ((stats as BodyStats | null)?.height_cm ?? fallback.height_cm) || null,
    weightLogs: ((logs || []) as BodyWeightLog[]).map((log) => ({
      ...log,
      weight_kg: Number(log.weight_kg),
      body_fat_percent:
        log.body_fat_percent === null ? null : Number(log.body_fat_percent),
    })),
  } satisfies ProfileState;
}

export async function saveWebWeightLog(log: Omit<BodyWeightLog, "id">) {
  const user = await getWebUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("body_weight_logs")
    .insert({
      user_id: user.id,
      date: log.date,
      logged_at: log.logged_at,
      weight_kg: log.weight_kg,
      body_fat_percent: log.body_fat_percent,
    })
    .select("id, date, logged_at, weight_kg, body_fat_percent")
    .single();

  if (error || !data) return null;
  return data as BodyWeightLog;
}

export async function saveWebHeight(heightCm: number) {
  const user = await getWebUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("body_stats")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    height_cm: heightCm,
    updated_at: new Date().toISOString(),
  };

  const query =
    existing
      ? supabase
          .from("body_stats")
          .update(payload)
          .eq("id", (existing as { id: string } | null)?.id)
          .select("height_cm")
      : supabase.from("body_stats").insert(payload).select("height_cm");

  const { data, error } = await query.single();
  if (error || !data) return null;

  return Number(data.height_cm);
}
