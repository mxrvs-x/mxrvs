"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Dumbbell,
  History,
  Play,
  RotateCcw,
  Settings,
  Square,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  emptyExercises,
  emptyWorkouts,
  formatDuration,
  formatMuscleGroup,
  formatWorkoutType,
  id,
  isWorkoutType,
  MiniStat,
  Modal,
  toDateKey,
  type Exercise,
  type MuscleGroup,
  type Workout,
  type WorkoutSet,
  type WorkoutType,
  WORKOUT_PLANS,
} from "@/app/components/shared";
import { loadWebWorkouts, saveWebWorkout, type SyncState } from "@/lib/webData";
import {
  clearStoredWorkoutSession,
  readStoredWorkoutSession,
  writeStoredWorkoutSession,
} from "@/lib/workoutSessionStore";
import { appAlert, appConfirm, appToast } from "@/lib/sweetAlert";

const REST_OPTIONS = [30, 60, 90, 120, 180, 240, 300];

const splitGroups: Record<Exclude<WorkoutType, "rest">, MuscleGroup[]> = {
  push: ["chest", "shoulders", "arms"],
  pull: ["back", "arms"],
  legs: ["legs", "core"],
  upper: ["chest", "back", "shoulders", "arms"],
  lower: ["legs", "arms", "core"],
};

function getInitialSplit(value: string | null): WorkoutType {
  return isWorkoutType(value) ? value : "push";
}

function getExerciseGroups(type: WorkoutType) {
  if (type === "rest") return [];
  return splitGroups[type];
}

export default function WorkoutSessionPage() {
  const params = useSearchParams();
  const routeSplit = getInitialSplit(params.get("split"));
  const firstTrainingSplit = routeSplit === "rest" ? "push" : routeSplit;

  const [syncState, setSyncState] = useState<SyncState>("local");
  const [exercises, setExercises] = useState<Exercise[]>(emptyExercises);
  const [workouts, setWorkouts] = useState<Workout[]>(emptyWorkouts);
  const [selectedType, setSelectedType] = useState<WorkoutType>(firstTrainingSplit);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(
    new Set(),
  );
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const [restExerciseId, setRestExerciseId] = useState<string | null>(null);
  const [modalRestSeconds, setModalRestSeconds] = useState(90);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [notes, setNotes] = useState("");
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoredSession, setRestoredSession] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.workoutTheme = selectedType;

    return () => {
      delete document.documentElement.dataset.workoutTheme;
    };
  }, [selectedType]);

  useEffect(() => {
    let active = true;

    loadWebWorkouts().then((data) => {
      if (!active) return;
      if (!data) {
        void appAlert(
          "Workout Load Failed",
          "Could not load exercises and workout data from Supabase.",
          "error",
        );
        return;
      }
      setExercises(data.exercises);
      setWorkouts(data.workouts);
      setSyncState("supabase");
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const stored = readStoredWorkoutSession();

    if (stored) {
      setSelectedType(stored.selectedType);
      setSelectedExerciseIds(new Set(stored.selectedExerciseIds));
      setStarted(true);
      setPaused(stored.paused);
      setElapsedSeconds(stored.elapsedSeconds);
      setRestRemaining(stored.restRemaining);
      setRestExerciseId(stored.restRemaining > 0 ? stored.restExerciseId : null);
      setSets(stored.sets);
      setNotes(stored.notes);
    }

    setRestoredSession(true);
  }, []);

  useEffect(() => {
    if (!started || paused) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
      setRestRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [paused, started]);

  useEffect(() => {
    if (!restoredSession) return;

    if (!started) {
      clearStoredWorkoutSession();
      return;
    }

    const now = Date.now();
    writeStoredWorkoutSession({
      selectedType,
      selectedExerciseIds: Array.from(selectedExerciseIds),
      started,
      paused,
      elapsedSeconds,
      elapsedUpdatedAt: now,
      restRemaining,
      restUpdatedAt: now,
      restExerciseId,
      sets,
      notes,
    });
  }, [
    elapsedSeconds,
    notes,
    paused,
    restoredSession,
    restExerciseId,
    restRemaining,
    selectedExerciseIds,
    selectedType,
    sets,
    started,
  ]);

  useEffect(() => {
    if (!started) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "Session is active, are you sure to close the tab?";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [started]);

  useEffect(() => {
    if (activeExercise && restRemaining <= 0) {
      setModalRestSeconds(90);
    }
  }, [activeExercise, restRemaining]);

  const todayWorkout = workouts.find(
    (workout) => workout.workout_date === toDateKey(),
  );
  const recommendedGroups = getExerciseGroups(selectedType);
  const visibleExercises = useMemo(() => {
    return exercises
      .filter((exercise) => recommendedGroups.includes(exercise.muscle_group))
      .sort(
        (a, b) =>
          Number(b.is_compound) - Number(a.is_compound) ||
          a.muscle_group.localeCompare(b.muscle_group) ||
          a.name.localeCompare(b.name),
      );
  }, [exercises, recommendedGroups]);
  const selectedExercises = visibleExercises.filter((exercise) =>
    selectedExerciseIds.has(exercise.id),
  );
  const activeExercises = started ? selectedExercises : visibleExercises;
  const sessionVolume = sets.reduce(
    (sum, set) => sum + set.reps * set.weight_kg,
    0,
  );

  function changeSplit(type: WorkoutType) {
    if (type === "rest" || started) return;
    setSelectedType(type);
    setSelectedExerciseIds(new Set());
  }

  function toggleExercise(exerciseId: string) {
    if (started) return;

    setSelectedExerciseIds((current) => {
      const next = new Set(current);

      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);

      return next;
    });
  }

  async function startWorkout() {
    if (selectedExerciseIds.size === 0) {
      await appAlert(
        "Select Exercises",
        "Choose at least one exercise before starting your workout.",
        "warning",
      );
      return;
    }
    setStarted(true);
    setPaused(false);
    await appToast("Workout started");
  }

  async function completeSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeExercise) return;

    const form = new FormData(event.currentTarget);
    const reps = Number(form.get("reps"));
    const weight = Number(form.get("weight"));

    if (
      !Number.isFinite(reps) ||
      reps <= 0 ||
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      await appAlert(
        "Invalid Set",
        "Enter valid reps and weight before completing the set.",
        "warning",
      );
      return;
    }

    const setNumber =
      sets.filter((set) => set.exercise_id === activeExercise.id).length + 1;

    setSets((current) => [
      ...current,
      {
        id: id("set"),
        exercise_id: activeExercise.id,
        exercise_name: activeExercise.name,
        set_number: setNumber,
        reps,
        weight_kg: weight,
        rest_seconds: modalRestSeconds,
      },
    ]);
    setRestRemaining(modalRestSeconds);
    setRestExerciseId(activeExercise.id);
    await appToast("Set logged");
  }

  async function saveWorkout() {
    if (saving) return;

    if (sets.length === 0) {
      await appAlert(
        "No Sets Logged",
        "Log at least one set before ending this workout.",
        "warning",
      );
      return;
    }

    const confirmed = await appConfirm({
      title: "End Workout?",
      text: "This will save your logged sets and clear the active session.",
      confirmButtonText: "Save Workout",
    });

    if (!confirmed) return;

    setSaving(true);

    const workout: Workout = {
      id: id("workout"),
      workout_date: toDateKey(),
      workout_type: selectedType,
      notes,
      duration_minutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      created_at: new Date().toISOString(),
      sets,
    };
    const savedWorkout = await saveWebWorkout(workout);

    if (!savedWorkout) {
      setSaving(false);
      await appAlert(
        "Save Failed",
        "Could not save this workout to Supabase. Your active session is still preserved.",
        "error",
      );
      return;
    }

    setWorkouts((current) => [savedWorkout, ...current]);
    setStarted(false);
    setPaused(false);
    setElapsedSeconds(0);
    setRestRemaining(0);
    setRestExerciseId(null);
    setSets([]);
    setNotes("");
    clearStoredWorkoutSession();
    setSaving(false);
    await appToast("Workout saved");
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workout Session</p>
          <h1>{formatWorkoutType(selectedType)}</h1>
          <p className="muted">
            Data source:{" "}
            {syncState === "supabase" ? "Supabase" : "Waiting for session"}
          </p>
        </div>
        <div className="row responsive">
          <Link
            className="button"
            href={`/pages/workouts/setup?split=${selectedType}`}
          >
            <Settings size={18} aria-hidden="true" />
            Setup
          </Link>
          <Link
            className="button"
            href={`/pages/workouts/history?split=${selectedType}`}
          >
            <History size={18} aria-hidden="true" />
            History
          </Link>
        </div>
      </header>

      {routeSplit === "rest" ? (
        <div className="panel soft-panel">
          <strong>Today is a rest day</strong>
          <p>Choose a focus below if you still want to train.</p>
        </div>
      ) : null}

      {todayWorkout ? (
        <div className="panel soft-panel" style={{ marginTop: 12 }}>
          <strong>Already logged today</strong>
          <p>
            {formatWorkoutType(todayWorkout.workout_type)} -{" "}
            {todayWorkout.duration_minutes} min
          </p>
        </div>
      ) : null}

      <section className="grid two-col" style={{ marginTop: 14 }}>
        <div className="stack">
          <div className="card stack session-panel">
            <div className="row between responsive">
              <div>
                <h2>Current Session</h2>
                <p className="muted">
                  {sets.length} sets - {sessionVolume.toLocaleString()} kg
                </p>
              </div>
              <strong style={{ fontSize: 34 }}>
                {formatDuration(elapsedSeconds)}
              </strong>
            </div>

            <div className="chips">
              {WORKOUT_PLANS.map((plan) => (
                <button
                  className={selectedType === plan.type ? "chip active" : "chip"}
                  disabled={started}
                  key={plan.type}
                  onClick={() => changeSplit(plan.type)}
                  type="button"
                >
                  {plan.short} {plan.label}
                </button>
              ))}
            </div>

            {restRemaining > 0 ? (
              <div className="panel soft-panel">
                <strong>Rest timer active</strong>
                <p>{formatDuration(restRemaining)}</p>
              </div>
            ) : null}

            {!started ? (
              <button
                className="button primary"
                disabled={selectedExerciseIds.size === 0}
                onClick={startWorkout}
                type="button"
              >
                <Play size={18} aria-hidden="true" />
                Start Workout
              </button>
            ) : (
              <div className="row responsive">
                <button
                  className="button"
                  onClick={() => setPaused((current) => !current)}
                  type="button"
                >
                  {paused ? "Resume" : "Pause"}
                </button>
                <button
                  className="button danger"
                  disabled={sets.length === 0 || saving}
                  onClick={saveWorkout}
                  type="button"
                >
                  <Square size={16} aria-hidden="true" />
                  {saving ? "Saving..." : "End Workout"}
                </button>
              </div>
            )}
          </div>

          <div className="card stack">
            <h2>{started ? "Selected Exercises" : "Select Exercises"}</h2>
            <p className="muted">
              {started
                ? `${selectedExercises.length} exercises in session`
                : `${selectedExerciseIds.size} selected from ${recommendedGroups
                    .map(formatMuscleGroup)
                    .join(", ")}`}
            </p>

            {activeExercises.length === 0 ? (
              <div className="panel">
                <strong>No exercises found</strong>
                <p className="muted">
                  Add exercises for this split in your mobile setup first.
                </p>
              </div>
            ) : null}

            <div className="split-list session-scroll">
              {activeExercises.map((exercise) => {
                const selected = selectedExerciseIds.has(exercise.id);
                const exerciseSets = sets.filter(
                  (set) => set.exercise_id === exercise.id,
                );
                const blockedByRest =
                  started &&
                  restRemaining > 0 &&
                  restExerciseId !== null &&
                  restExerciseId !== exercise.id;

                return (
                  <button
                    className="list-item exercise-row"
                    disabled={blockedByRest}
                    key={exercise.id}
                    onClick={() =>
                      started
                        ? setActiveExercise(exercise)
                        : toggleExercise(exercise.id)
                    }
                    style={{ opacity: blockedByRest ? 0.5 : 1 }}
                    type="button"
                  >
                    {!started ? (
                      <span className={selected ? "check-dot active" : "check-dot"}>
                        {selected ? <Check size={14} /> : ""}
                      </span>
                    ) : (
                      <Dumbbell size={20} />
                    )}
                    <span style={{ textAlign: "left" }}>
                      <strong>{exercise.name}</strong>
                      <span
                        className="muted"
                        style={{ display: "block", marginTop: 4 }}
                      >
                        {formatMuscleGroup(exercise.muscle_group)} -{" "}
                        {exercise.is_compound ? "Compound" : "Isolation"}
                      </span>
                    </span>
                    {started ? (
                      <MiniStat label="Sets" value={`${exerciseSets.length}`} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="stack">
          <div className="card stack">
            <div className="row between">
              <h2>Logged Sets</h2>
              {restRemaining > 0 ? (
                <button
                  className="icon-button"
                  onClick={() => {
                    setRestRemaining(0);
                    setRestExerciseId(null);
                  }}
                  title="Skip rest"
                  type="button"
                >
                  <RotateCcw size={17} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {sets.length === 0 ? (
              <p className="muted">
                Start the workout, tap an exercise, then complete Set 1.
              </p>
            ) : null}
            <div className="session-scroll">
              {sets.map((set) => (
                <div className="list-item row between" key={set.id}>
                  <div>
                    <strong>{set.exercise_name}</strong>
                    <p className="muted">
                      Set {set.set_number} - {set.reps} reps x {set.weight_kg} kg
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() =>
                      setSets((current) =>
                        current.filter((item) => item.id !== set.id),
                      )
                    }
                    title="Remove set"
                    type="button"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card stack session-notes-card">
            <h2>Notes</h2>
            <textarea
              className="textarea"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Energy, fatigue, form notes..."
              value={notes}
            />
          </div>
        </aside>
      </section>

      {activeExercise ? (
        <Modal
          title={`Log ${activeExercise.name}`}
          onClose={() => setActiveExercise(null)}
        >
          {restRemaining > 0 && restExerciseId === activeExercise.id ? (
            <div className="stack">
              <div className="session-rest-display">
                <strong>{formatDuration(restRemaining)}</strong>
                <p className="muted">
                  Rest before Set{" "}
                  {sets.filter((set) => set.exercise_id === activeExercise.id)
                    .length + 1}
                </p>
              </div>
              <button
                className="button primary"
                onClick={() => {
                  setRestRemaining(0);
                  setRestExerciseId(null);
                }}
                type="button"
              >
                Skip Rest
              </button>
            </div>
          ) : (
            <form className="stack" onSubmit={completeSet}>
              <div className="grid two-col">
                <div className="field">
                  <label htmlFor="reps">Reps</label>
                  <input
                    className="input"
                    defaultValue="8"
                    id="reps"
                    min="1"
                    name="reps"
                    required
                    type="number"
                  />
                </div>
                <div className="field">
                  <label htmlFor="weight">Weight kg</label>
                  <input
                    className="input"
                    defaultValue="40"
                    id="weight"
                    min="0"
                    name="weight"
                    required
                    step="0.5"
                    type="number"
                  />
                </div>
              </div>

              <div className="field">
                <label>Rest after this set</label>
                <div className="rest-picker">
                  {REST_OPTIONS.map((seconds) => (
                    <button
                      className={
                        modalRestSeconds === seconds ? "chip active" : "chip"
                      }
                      key={seconds}
                      onClick={() => setModalRestSeconds(seconds)}
                      type="button"
                    >
                      {formatDuration(seconds)}
                    </button>
                  ))}
                </div>
              </div>

              <button className="button primary" type="submit">
                Complete Set & Start Rest
              </button>
            </form>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
