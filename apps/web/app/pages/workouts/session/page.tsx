"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Dumbbell,
  History,
  Plus,
  Play,
  RotateCcw,
  Settings,
  Square,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  emptyExercises,
  emptyWorkouts,
  formatDuration,
  formatMuscleGroup,
  formatWorkoutType,
  id,
  isExerciseRecommendedForWorkout,
  isWorkoutType,
  MiniStat,
  Modal,
  RECOVERY_METRICS,
  createRecoveryCheckIn,
  toDateKey,
  type Exercise,
  type RecoveryCheckIn,
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
const REST_COMPLETE_SOUND = "/sounds/timer-complete.mp3";

function getInitialSplit(value: string | null): WorkoutType {
  return isWorkoutType(value) && value !== "rest" ? value : "push";
}

function playRestCompleteSound() {
  if (typeof window === "undefined") return;

  try {
    window.navigator.vibrate?.([0, 500, 250, 500, 250, 700]);

    const audio = new Audio(REST_COMPLETE_SOUND);
    audio.volume = 1;

    void audio.play().catch(() => {
      window.navigator.vibrate?.([0, 500, 250, 500]);
    });
  } catch {
    window.navigator.vibrate?.([0, 500, 250, 500]);
  }
}

export default function WorkoutSessionPage() {
  const params = useSearchParams();
  const routeSplitParam = params.get("split");
  const firstTrainingSplit = getInitialSplit(routeSplitParam);

  const [syncState, setSyncState] = useState<SyncState>("local");
  const [exercises, setExercises] = useState<Exercise[]>(emptyExercises);
  const [workouts, setWorkouts] = useState<Workout[]>(emptyWorkouts);
  const [selectedType, setSelectedType] = useState<WorkoutType>(firstTrainingSplit);
  const [splitChosen, setSplitChosen] = useState(
    isWorkoutType(routeSplitParam) && routeSplitParam !== "rest",
  );
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
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoredSession, setRestoredSession] = useState(false);
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryCheckIn>(() =>
    createRecoveryCheckIn(3),
  );
  const previousRestRemainingRef = useRef(0);

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
      setSplitChosen(true);
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
    const previousRestRemaining = previousRestRemainingRef.current;

    if (started && !paused && previousRestRemaining > 0 && restRemaining === 0) {
      setRestExerciseId(null);
      playRestCompleteSound();
    }

    previousRestRemainingRef.current = restRemaining;
  }, [paused, restRemaining, started]);

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
  const visibleExercises = useMemo(() => {
    if (!splitChosen) return [];

    return exercises
      .filter((exercise) =>
        isExerciseRecommendedForWorkout(exercise, selectedType),
      )
      .sort(
        (a, b) =>
          Number(b.is_compound) - Number(a.is_compound) ||
          a.muscle_group.localeCompare(b.muscle_group) ||
          a.name.localeCompare(b.name),
      );
  }, [exercises, selectedType, splitChosen]);
  const selectedExercises = exercises
    .filter((exercise) => selectedExerciseIds.has(exercise.id))
    .sort(
      (a, b) =>
        Number(b.is_compound) - Number(a.is_compound) ||
        a.muscle_group.localeCompare(b.muscle_group) ||
        a.name.localeCompare(b.name),
    );
  const activeExercises = started
    ? selectedExercises
    : visibleExercises;
  const availableExercises = started
    ? exercises
        .filter((exercise) => !selectedExerciseIds.has(exercise.id))
        .sort(
        (a, b) =>
          Number(b.is_compound) - Number(a.is_compound) ||
          a.muscle_group.localeCompare(b.muscle_group) ||
          a.name.localeCompare(b.name),
      )
    : [];
  const matchingAvailableExercises = availableExercises.filter((exercise) => {
    const query = exerciseSearch.trim().toLowerCase();
    if (!query) return true;

    return (
      exercise.name.toLowerCase().includes(query) ||
      formatMuscleGroup(exercise.muscle_group).toLowerCase().includes(query)
    );
  });
  const sessionVolume = sets.reduce(
    (sum, set) => sum + set.reps * set.weight_kg,
    0,
  );

  function changeSplit(type: WorkoutType) {
    if (type === "rest" || started) return;
    setSelectedType(type);
    setSplitChosen(true);
    setSelectedExerciseIds(new Set());
  }

  function toggleExercise(exerciseId: string) {
    setSelectedExerciseIds((current) => {
      const next = new Set(current);

      if (next.has(exerciseId) && !started) next.delete(exerciseId);
      else if (!next.has(exerciseId)) next.add(exerciseId);

      return next;
    });
  }

  function handleExerciseClick(exercise: Exercise) {
    if (started && selectedExerciseIds.has(exercise.id)) {
      setActiveExercise(exercise);
      return;
    }
    toggleExercise(exercise.id);
  }

  async function addExerciseToSession(exercise: Exercise) {
    if (!started || selectedExerciseIds.has(exercise.id)) return;

    toggleExercise(exercise.id);
    setExerciseSearch("");
    setExercisePickerOpen(false);
    await appToast(`${exercise.name} added`);
  }

  async function removeExerciseFromSession(exercise: Exercise) {
    if (!started || !selectedExerciseIds.has(exercise.id)) return;

    const exerciseSetCount = sets.filter(
      (set) => set.exercise_id === exercise.id,
    ).length;
    const confirmed = await appConfirm({
      title: "Remove Exercise?",
      text:
        exerciseSetCount > 0
          ? `This removes ${exercise.name} and its ${exerciseSetCount} logged set${exerciseSetCount === 1 ? "" : "s"} from this session.`
          : `This removes ${exercise.name} from this session.`,
      confirmButtonText: "Remove Exercise",
      icon: "warning",
    });
    if (!confirmed) return;

    setSelectedExerciseIds((current) => {
      const next = new Set(current);
      next.delete(exercise.id);
      return next;
    });
    setSets((current) =>
      current.filter((set) => set.exercise_id !== exercise.id),
    );

    if (activeExercise?.id === exercise.id) setActiveExercise(null);
    if (restExerciseId === exercise.id) {
      setRestRemaining(0);
      setRestExerciseId(null);
    }

    await appToast(`${exercise.name} removed`);
  }

  async function startWorkout() {
    if (!splitChosen) {
      await appAlert(
        "Choose Workout Split",
        "Select a workout split before starting your session.",
        "warning",
      );
      return;
    }

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

  async function requestEndWorkout() {
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

    setRecovery(createRecoveryCheckIn(3));
    setRecoveryVisible(true);
  }

  async function saveWorkout(recoveryCheckIn: RecoveryCheckIn) {
    if (saving) return;

    setRecoveryVisible(false);
    setSaving(true);

    const workout: Workout = {
      id: id("workout"),
      workout_date: toDateKey(),
      workout_type: selectedType,
      notes,
      duration_minutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      created_at: new Date().toISOString(),
      ...recoveryCheckIn,
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
          <h1>{splitChosen ? formatWorkoutType(selectedType) : "Choose a Split"}</h1>
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
                  className={
                    splitChosen && selectedType === plan.type
                      ? "chip active"
                      : "chip"
                  }
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
                disabled={!splitChosen || selectedExerciseIds.size === 0}
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
                  onClick={requestEndWorkout}
                  type="button"
                >
                  <Square size={16} aria-hidden="true" />
                  {saving ? "Saving..." : "End Workout"}
                </button>
              </div>
            )}
          </div>

          <div className="card stack">
            <h2>{started ? "Session Exercises" : "Select Exercises"}</h2>
            <p className="muted">
              {started
                ? `${selectedExercises.length} exercises in this session.`
                : splitChosen
                  ? `${selectedExerciseIds.size} selected from ${formatWorkoutType(
                      selectedType,
                    )}`
                  : "Choose a workout split to see matching exercises."}
            </p>

            {started && availableExercises.length > 0 ? (
              <div className="stack">
                <button
                  aria-expanded={exercisePickerOpen}
                  className="button"
                  onClick={() => {
                    setExercisePickerOpen((current) => !current);
                    setExerciseSearch("");
                  }}
                  type="button"
                >
                  <Plus size={18} aria-hidden="true" />
                  {exercisePickerOpen ? "Close Exercise Picker" : "Add Exercise"}
                </button>

                {exercisePickerOpen ? (
                  <div className="panel stack">
                    <input
                      aria-label="Search exercises"
                      autoFocus
                      className="input"
                      onChange={(event) => setExerciseSearch(event.target.value)}
                      placeholder="Search by exercise or muscle group..."
                      type="search"
                      value={exerciseSearch}
                    />
                    <div className="split-list session-scroll">
                      {matchingAvailableExercises.map((exercise) => (
                        <button
                          className="list-item row between"
                          key={exercise.id}
                          onClick={() => void addExerciseToSession(exercise)}
                          type="button"
                        >
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
                          <Plus size={18} aria-hidden="true" />
                        </button>
                      ))}
                      {matchingAvailableExercises.length === 0 ? (
                        <p className="muted">No exercises match your search.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {started && availableExercises.length === 0 ? (
              <p className="muted">All available exercises are in this session.</p>
            ) : null}

            {activeExercises.length === 0 ? (
              <div className="panel">
                <strong>
                  {splitChosen ? "No exercises found" : "Choose a workout split"}
                </strong>
                <p className="muted">
                  {splitChosen
                    ? "Add exercises for these muscle groups in setup first."
                    : "Select Push, Pull, Legs, Upper Body, Lower, or Arms above."}
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
                  selected &&
                  restRemaining > 0 &&
                  restExerciseId !== null &&
                  restExerciseId !== exercise.id;

                return (
                  <div className="row" key={exercise.id}>
                    <button
                      className="list-item exercise-row"
                      disabled={blockedByRest}
                      onClick={() => handleExerciseClick(exercise)}
                      style={{ flex: 1, opacity: blockedByRest ? 0.5 : 1 }}
                      type="button"
                    >
                      {!started || !selected ? (
                        <span className={selected ? "check-dot active" : "check-dot"}>
                          {selected ? <Check size={14} /> : started ? "+" : ""}
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
                        <MiniStat
                          label={selected ? "Sets" : "Action"}
                          value={selected ? `${exerciseSets.length}` : "Add"}
                        />
                      ) : null}
                    </button>
                    {started ? (
                      <button
                        aria-label={`Remove ${exercise.name} from session`}
                        className="icon-button"
                        onClick={() => void removeExerciseFromSession(exercise)}
                        title="Remove exercise from session"
                        type="button"
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
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

      {recoveryVisible ? (
        <Modal
          title="Recovery Check-in"
          onClose={() => setRecoveryVisible(false)}
        >
          <p className="muted">
            Rate how you feel before saving. Soreness and Stress use higher
            scores for more discomfort.
          </p>
          {RECOVERY_METRICS.map((metric) => (
            <div className="field" key={metric.key}>
              <div className="row between responsive">
                <label>{metric.label}</label>
                <span className="muted">{metric.hint}</span>
              </div>
              <div className="rest-picker">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    className={
                      recovery[metric.key] === score ? "chip active" : "chip"
                    }
                    key={score}
                    onClick={() =>
                      setRecovery((current) => ({
                        ...current,
                        [metric.key]: score,
                      }))
                    }
                    type="button"
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="row responsive">
            <button
              className="button"
              disabled={saving}
              onClick={() => void saveWorkout(createRecoveryCheckIn())}
              type="button"
            >
              Skip
            </button>
            <button
              className="button primary"
              disabled={saving}
              onClick={() => void saveWorkout(recovery)}
              type="button"
            >
              {saving ? "Saving..." : "Save Workout"}
            </button>
          </div>
        </Modal>
      ) : null}

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
