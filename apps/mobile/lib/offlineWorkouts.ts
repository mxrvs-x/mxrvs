import { isOnline } from "@/lib/offlineCardio";
import { resolveOfflineUserId } from "@/lib/offlineUser";
import { supabase } from "@/lib/supabase";
import {
  dedupeExercisesByMuscleGroup,
  type WorkoutType,
} from "@/lib/workoutPlans";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CachedExercise = {
  id: string;
  name: string;
  muscle_group: string | null;
  movement_type: WorkoutType | null;
  is_compound: boolean;
};

export type OfflineWorkoutSet = {
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rest_seconds: number | null;
};

export type OfflineWorkout = {
  temp_id: string;
  user_id: string;
  workout_date: string;
  workout_type: WorkoutType;
  notes: string | null;
  duration_minutes: number;
  created_at: string;
  sets: OfflineWorkoutSet[];
};

const OFFLINE_WORKOUTS_KEY = "offline_workouts";
const CACHED_WORKOUTS_KEY = "cached_workouts";
const CACHED_WORKOUT_SETS_KEY = "cached_workout_sets";
const CACHED_EXERCISES_KEY = "cached_workout_exercises";

type SyncResult = { synced: number; remaining: number };

let syncPromise: Promise<SyncResult> | null = null;

export async function getOfflineWorkouts() {
  const raw = await AsyncStorage.getItem(OFFLINE_WORKOUTS_KEY);
  return raw ? (JSON.parse(raw) as OfflineWorkout[]) : [];
}

export async function getCachedWorkouts() {
  const raw = await AsyncStorage.getItem(CACHED_WORKOUTS_KEY);
  return raw ? (JSON.parse(raw) as any[]) : [];
}

export async function cacheWorkouts(workouts: any[]) {
  await AsyncStorage.setItem(CACHED_WORKOUTS_KEY, JSON.stringify(workouts));
}

export async function getCachedWorkoutSets() {
  const raw = await AsyncStorage.getItem(CACHED_WORKOUT_SETS_KEY);
  return raw ? (JSON.parse(raw) as any[]) : [];
}

export async function cacheWorkoutSets(sets: any[]) {
  await AsyncStorage.setItem(CACHED_WORKOUT_SETS_KEY, JSON.stringify(sets));
}

async function setOfflineWorkouts(workouts: OfflineWorkout[]) {
  await AsyncStorage.setItem(OFFLINE_WORKOUTS_KEY, JSON.stringify(workouts));
}

function areSamePendingWorkoutSet(
  a: OfflineWorkoutSet,
  b: OfflineWorkoutSet,
) {
  return (
    a.exercise_id === b.exercise_id &&
    a.set_number === b.set_number &&
    a.reps === b.reps &&
    a.weight_kg === b.weight_kg &&
    (a.rest_seconds ?? null) === (b.rest_seconds ?? null)
  );
}

function isSamePendingWorkout(a: OfflineWorkout, b: OfflineWorkout) {
  return (
    a.temp_id === b.temp_id ||
    (a.user_id === b.user_id &&
      a.workout_date === b.workout_date &&
      a.workout_type === b.workout_type &&
      a.duration_minutes === b.duration_minutes &&
      (a.notes ?? null) === (b.notes ?? null) &&
      a.sets.length === b.sets.length &&
      a.sets.every((set, index) =>
        areSamePendingWorkoutSet(set, b.sets[index]),
      ))
  );
}

export async function saveOfflineWorkout(workout: OfflineWorkout) {
  const existing = await getOfflineWorkouts();
  await setOfflineWorkouts([
    workout,
    ...existing.filter((item) => !isSamePendingWorkout(item, workout)),
  ]);
}

export async function removeOfflineWorkout(tempId: string) {
  const existing = await getOfflineWorkouts();
  await setOfflineWorkouts(
    existing.filter((workout) => workout.temp_id !== tempId),
  );
}

export async function cacheWorkoutExercises(exercises: CachedExercise[]) {
  await AsyncStorage.setItem(CACHED_EXERCISES_KEY, JSON.stringify(exercises));
}

export async function getCachedWorkoutExercises() {
  const raw = await AsyncStorage.getItem(CACHED_EXERCISES_KEY);
  const exercises = raw ? (JSON.parse(raw) as CachedExercise[]) : [];

  return dedupeExercisesByMuscleGroup(exercises);
}

export function mapOfflineWorkout(workout: OfflineWorkout) {
  const totalVolume = workout.sets.reduce((sum, set) => {
    return sum + Number(set.reps || 0) * Number(set.weight_kg || 0);
  }, 0);

  return {
    id: workout.temp_id,
    workout_date: workout.workout_date,
    workout_type: workout.workout_type,
    notes: workout.notes,
    duration_minutes: workout.duration_minutes,
    created_at: workout.created_at,
    set_count: workout.sets.length,
    total_volume: totalVolume,
    offline: true,
  };
}

export function mapCachedWorkout(workout: any, sets: any[] = []) {
  const workoutSets = sets.filter((set) => set.workout_id === workout.id);
  const totalVolume = workoutSets.reduce((sum, set) => {
    return sum + Number(set.reps || 0) * Number(set.weight_kg || 0);
  }, 0);

  return {
    ...workout,
    set_count: workoutSets.length,
    total_volume: totalVolume,
  };
}

async function runOfflineWorkoutSync(): Promise<SyncResult> {
  const online = await isOnline();
  if (!online) return { synced: 0, remaining: 0 };

  const workouts = await getOfflineWorkouts();
  if (workouts.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;

  for (const workout of workouts) {
    const { temp_id, sets, ...payload } = workout;

    const { data: existing, error: existingError } = await supabase
      .from("workouts")
      .select("id")
      .eq("user_id", workout.user_id)
      .eq("workout_date", workout.workout_date)
      .limit(1);

    if (!existingError && existing && existing.length > 0) {
      await removeOfflineWorkout(temp_id);
      continue;
    }

    const { data, error } = await supabase
      .from("workouts")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data) {
      console.log("Offline workout sync error:", error);
      continue;
    }

    const rows = sets.map((set) => ({
      user_id: workout.user_id,
      workout_id: data.id,
      exercise_id: set.exercise_id,
      set_number: set.set_number,
      reps: set.reps,
      weight_kg: set.weight_kg,
      rest_seconds: set.rest_seconds,
    }));

    const { error: setsError } = await supabase.from("workout_sets").insert(rows);

    if (setsError) {
      console.log("Offline workout sets sync error:", setsError);
      await supabase.from("workouts").delete().eq("id", data.id);
      continue;
    }

    await removeOfflineWorkout(temp_id);
    synced++;
  }

  const remaining = await getOfflineWorkouts();

  return {
    synced,
    remaining: remaining.length,
  };
}

export async function syncOfflineWorkouts() {
  if (syncPromise) return syncPromise;

  syncPromise = runOfflineWorkoutSync().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}

export async function createOfflineWorkout({
  workout_date,
  workout_type,
  notes,
  duration_minutes,
  sets,
}: {
  workout_date: string;
  workout_type: WorkoutType;
  notes: string | null;
  duration_minutes: number;
  sets: OfflineWorkoutSet[];
}) {
  const userId = await resolveOfflineUserId();

  if (!userId) {
    throw new Error("Open the app once while online before logging workouts offline.");
  }

  const workout: OfflineWorkout = {
    temp_id: `offline_workout_${workout_date}_${Date.now()}`,
    user_id: userId,
    workout_date,
    workout_type,
    notes,
    duration_minutes,
    created_at: new Date().toISOString(),
    sets,
  };

  await saveOfflineWorkout(workout);
  return workout;
}
