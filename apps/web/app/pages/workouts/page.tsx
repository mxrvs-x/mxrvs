"use client";

import {
  Check,
  Dumbbell,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import {
  ActivityCalendar,
  emptyExercises,
  emptyWorkouts,
  Exercise,
  MiniStat,
  Modal,
  MUSCLE_GROUPS,
  MuscleGroup,
  formatDate,
  formatDuration,
  formatMuscleGroup,
  formatWorkoutType,
  getTodayWorkoutPlan,
  id,
  toDateKey,
  totalVolume,
  useLocalState,
  Workout,
  WorkoutSet,
  WorkoutType,
  WORKOUT_PLANS,
  WorkoutVolumeChart,
} from "../_components/shared";
import {
  deleteWebExercise,
  loadWebWorkouts,
  saveWebExercise,
  saveWebWorkout,
  type SyncState,
} from "@/lib/webData";

type TabKey = "session" | "setup" | "history";
type ExerciseForm = {
  id?: string;
  name: string;
  muscle_group: MuscleGroup;
  is_compound: boolean;
};

const emptyExerciseForm: ExerciseForm = {
  name: "",
  muscle_group: "chest",
  is_compound: false,
};

const splitColors: Record<WorkoutType, string> = {
  push: "#ef4444",
  pull: "#3b82f6",
  legs: "#a855f7",
  upper: "#f97316",
  lower: "#22c55e",
  rest: "#6b7280",
};

export default function WorkoutsPage() {
  const [tab, setTab] = useState<TabKey>("session");
  const [exercises, setExercises] = useLocalState("mxrvs-web-exercises", emptyExercises);
  const [workouts, setWorkouts] = useLocalState("mxrvs-web-workouts", emptyWorkouts);
  const suggested = useMemo(() => getTodayWorkoutPlan(), []);
  const defaultType = suggested.type === "rest" ? "push" : suggested.type;
  const [selectedType, setSelectedType] = useState<WorkoutType>(defaultType);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [notes, setNotes] = useState("");
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | MuscleGroup>("all");
  const [exerciseForm, setExerciseForm] = useState<ExerciseForm | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("local");

  useEffect(() => {
    let active = true;

    loadWebWorkouts().then((data) => {
      if (!active || !data) return;
      setExercises(data.exercises);
      setWorkouts(data.workouts);
      setSyncState("supabase");
    });

    return () => {
      active = false;
    };
  }, [setExercises, setWorkouts]);

  const todayWorkout = workouts.find((workout) => workout.workout_date === toDateKey());
  const selectedExercises = exercises.filter((exercise) => selectedExerciseIds.has(exercise.id));
  const sessionVolume = sets.reduce((sum, set) => sum + set.reps * set.weight_kg, 0);

  useEffect(() => {
    document.documentElement.dataset.workoutTheme = selectedType;

    return () => {
      delete document.documentElement.dataset.workoutTheme;
    };
  }, [selectedType]);

  useEffect(() => {
    if (!started || paused) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
      setRestRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused, started]);

  const groupedExercises = useMemo(() => {
    const visible =
      filter === "all"
        ? exercises
        : exercises.filter((exercise) => exercise.muscle_group === filter);

    return MUSCLE_GROUPS.map((group) => [
      group,
      visible
        .filter((exercise) => exercise.muscle_group === group)
        .sort((a, b) => Number(b.is_compound) - Number(a.is_compound) || a.name.localeCompare(b.name)),
    ] as const).filter(([, groupExercises]) => groupExercises.length > 0);
  }, [exercises, filter]);

  const activeDates = useMemo(() => {
    return workouts.reduce<Record<string, number>>((acc, workout) => {
      acc[workout.workout_date] = (acc[workout.workout_date] || 0) + 1;
      return acc;
    }, {});
  }, [workouts]);

  const filteredWorkouts = useMemo(() => {
    const sorted = [...workouts].sort((a, b) => b.workout_date.localeCompare(a.workout_date));
    return selectedDate ? sorted.filter((workout) => workout.workout_date === selectedDate) : sorted;
  }, [selectedDate, workouts]);

  function toggleExercise(exerciseId: string) {
    if (started) return;
    setSelectedExerciseIds((current) => {
      const next = new Set(current);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }

  function completeSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeExercise) return;
    const form = new FormData(event.currentTarget);
    const reps = Number(form.get("reps"));
    const weight = Number(form.get("weight"));
    const rest = Number(form.get("rest")) || 90;

    if (!Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) return;

    const setNumber = sets.filter((set) => set.exercise_id === activeExercise.id).length + 1;
    setSets((current) => [
      ...current,
      {
        id: id("set"),
        exercise_id: activeExercise.id,
        exercise_name: activeExercise.name,
        set_number: setNumber,
        reps,
        weight_kg: weight,
        rest_seconds: rest,
      },
    ]);
    setRestRemaining(rest);
    setActiveExercise(null);
  }

  async function saveWorkout() {
    if (sets.length === 0) return;
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
    setWorkouts((current) => [savedWorkout || workout, ...current]);
    setStarted(false);
    setPaused(false);
    setElapsedSeconds(0);
    setRestRemaining(0);
    setSets([]);
    setNotes("");
  }

  async function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exerciseForm?.name.trim()) return;

    const savedExercise = await saveWebExercise(exerciseForm);
    const nextExercise = savedExercise || {
      id: exerciseForm.id || id("exercise"),
      name: exerciseForm.name.trim(),
      muscle_group: exerciseForm.muscle_group,
      is_compound: exerciseForm.is_compound,
    };

    if (exerciseForm.id) {
      setExercises((current) =>
        current.map((exercise) =>
          exercise.id === exerciseForm.id
            ? nextExercise
            : exercise,
        ),
      );
    } else {
      setExercises((current) => [...current, nextExercise]);
    }

    setExerciseForm(null);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Training</p>
          <h1>Workouts</h1>
          <p className="muted">Data source: {syncState === "supabase" ? "Supabase" : "Waiting for session"}</p>
        </div>
        <button className="button primary" onClick={() => setTab("session")} type="button">
          <Play size={18} aria-hidden="true" />
          Start session
        </button>
      </header>

      <div className="tabs">
        {(["session", "setup", "history"] as TabKey[]).map((item) => (
          <button className={tab === item ? "tab active" : "tab"} key={item} onClick={() => setTab(item)} type="button">
            {item === "session" ? "Session" : item === "setup" ? "Setup" : "History"}
          </button>
        ))}
      </div>

      {tab === "session" ? (
        <section className="grid two-col">
          <div className="stack">
            <div
              className="card split-themed"
              style={{ "--split-primary": splitColors[suggested.type] } as CSSProperties}
            >
              <p className="eyebrow" style={{ color: "inherit" }}>Suggested Focus</p>
              <h2>{suggested.short} {suggested.label}</h2>
              <p>{suggested.type === "rest" ? "Recovery day. Keep it light or rest fully." : "You can switch focus before starting."}</p>
            </div>

            {todayWorkout ? (
              <div className="panel soft-panel">
                <strong>Already logged today</strong>
                <p>{formatWorkoutType(todayWorkout.workout_type)} - {todayWorkout.duration_minutes} min</p>
              </div>
            ) : null}

            <div className="card stack session-panel">
              <div className="row between responsive">
                <div>
                  <h2>Current Session</h2>
                  <p className="muted">{formatWorkoutType(selectedType)} - {sets.length} sets - {sessionVolume.toLocaleString()} kg</p>
                </div>
                <strong style={{ fontSize: 34 }}>{formatDuration(elapsedSeconds)}</strong>
              </div>

              <div className="chips">
                {WORKOUT_PLANS.map((plan) => (
                  <button
                    className={selectedType === plan.type ? "chip active" : "chip"}
                    disabled={started}
                    key={plan.type}
                    onClick={() => setSelectedType(plan.type)}
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
                  onClick={() => setStarted(true)}
                  type="button"
                >
                  <Play size={18} aria-hidden="true" />
                  Start Workout
                </button>
              ) : (
                <div className="row responsive">
                  <button className="button" onClick={() => setPaused((current) => !current)} type="button">
                    {paused ? "Resume" : "Pause"}
                  </button>
                  <button className="button danger" disabled={sets.length === 0} onClick={saveWorkout} type="button">
                    <Square size={16} aria-hidden="true" />
                    End Workout
                  </button>
                </div>
              )}
            </div>

            <div className="card stack">
              <h2>{started ? "Selected Exercises" : "Select Exercises"}</h2>
              <p className="muted">{selectedExerciseIds.size} selected</p>
              <div className="split-list">
                {(started ? selectedExercises : exercises).map((exercise) => {
                  const selected = selectedExerciseIds.has(exercise.id);
                  const exerciseSets = sets.filter((set) => set.exercise_id === exercise.id);
                  return (
                    <button className="list-item exercise-row" key={exercise.id} onClick={() => started ? setActiveExercise(exercise) : toggleExercise(exercise.id)} type="button">
                      {!started ? <span className={selected ? "check-dot active" : "check-dot"}>{selected ? <Check size={14} /> : ""}</span> : <Dumbbell size={20} />}
                      <span style={{ textAlign: "left" }}>
                        <strong>{exercise.name}</strong>
                        <span className="muted" style={{ display: "block", marginTop: 4 }}>
                          {formatMuscleGroup(exercise.muscle_group)} - {exercise.is_compound ? "Compound" : "Isolation"}
                        </span>
                      </span>
                      {started ? <MiniStat label="Sets" value={`${exerciseSets.length}`} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="stack">
            <div className="card stack">
              <h2>Logged Sets</h2>
              {sets.length === 0 ? <p className="muted">Start the workout, tap an exercise, then complete Set 1.</p> : null}
              {sets.map((set) => (
                <div className="list-item row between" key={set.id}>
                  <div>
                    <strong>{set.exercise_name}</strong>
                    <p className="muted">Set {set.set_number} - {set.reps} reps x {set.weight_kg} kg</p>
                  </div>
                  <button className="icon-button" onClick={() => setSets((current) => current.filter((item) => item.id !== set.id))} title="Remove set" type="button">
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <div className="card stack">
              <h2>Notes</h2>
              <textarea className="textarea" onChange={(event) => setNotes(event.target.value)} placeholder="Energy, fatigue, form notes..." value={notes} />
            </div>
          </aside>
        </section>
      ) : null}

      {tab === "setup" ? (
        <section className="stack">
          <div className="card row between responsive">
            <div>
              <p className="muted">Exercise Library by Muscle Group</p>
              <h2>{exercises.length} exercises</h2>
            </div>
            <button className="button primary" onClick={() => setExerciseForm(emptyExerciseForm)} type="button">
              <Plus size={18} aria-hidden="true" />
              Add Exercise
            </button>
          </div>

          <div className="chips">
            {(["all", ...MUSCLE_GROUPS] as const).map((item) => (
              <button className={filter === item ? "chip active" : "chip"} key={item} onClick={() => setFilter(item)} type="button">
                {item === "all" ? "All" : formatMuscleGroup(item)}
              </button>
            ))}
          </div>

          {groupedExercises.map(([group, groupExercises]) => (
            <div className="stack" key={group}>
              <h2>{formatMuscleGroup(group)} ({groupExercises.length})</h2>
              {groupExercises.map((exercise) => (
                <div className="list-item row between responsive" key={exercise.id}>
                  <div>
                    <strong>{exercise.name}</strong>
                    <p className="muted">{exercise.is_compound ? "Compound" : "Isolation"}</p>
                  </div>
                  <div className="row exercise-actions">
                    <button className="icon-button" onClick={() => setExerciseForm(exercise)} title="Edit exercise" type="button">
                      <Pencil size={17} aria-hidden="true" />
                    </button>
                    <button className="icon-button" onClick={async () => {
                      await deleteWebExercise(exercise.id);
                      setExercises((current) => current.filter((item) => item.id !== exercise.id));
                    }} title="Delete exercise" type="button">
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      ) : null}

      {tab === "history" ? (
        <section className="grid two-col">
          <div className="stack">
            <ActivityCalendar activeDates={activeDates} marker="W" selectedDate={selectedDate} onSelectDate={(date) => setSelectedDate((current) => current === date ? null : date)}>
              {selectedDate ? <p className="muted">{activeDates[selectedDate] || 0} sessions on {formatDate(selectedDate)}</p> : null}
            </ActivityCalendar>
            <div className="card">
              <h2>Workout Reports</h2>
              <div className="chart-wrap">
                <WorkoutVolumeChart workouts={workouts} />
              </div>
            </div>
          </div>

          <div className="stack">
            <div className="row between">
              <h2>{selectedDate ? "Selected Date" : "Sessions"}</h2>
              <strong className="muted">{filteredWorkouts.length}</strong>
            </div>
            {filteredWorkouts.map((workout) => (
              <article className="list-item stack" key={workout.id}>
                <div className="row between">
                  <div>
                    <h3>{formatWorkoutType(workout.workout_type)}</h3>
                    <p className="muted">{workout.notes || "Workout session"}</p>
                  </div>
                  <span className="faint">{formatDate(workout.workout_date)}</span>
                </div>
                <div className="row wrap">
                  <MiniStat label="Duration" value={`${workout.duration_minutes} min`} />
                  <MiniStat label="Sets" value={`${workout.sets.length}`} />
                  <MiniStat label="Volume" value={`${totalVolume(workout).toLocaleString()} kg`} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeExercise ? (
        <Modal title={`Log ${activeExercise.name}`} onClose={() => setActiveExercise(null)}>
          <form className="stack" onSubmit={completeSet}>
            <div className="grid three-col">
              <div className="field">
                <label htmlFor="reps">Reps</label>
                <input className="input" id="reps" min="1" name="reps" required type="number" defaultValue="8" />
              </div>
              <div className="field">
                <label htmlFor="weight">Weight kg</label>
                <input className="input" id="weight" min="0" name="weight" required step="0.5" type="number" defaultValue="40" />
              </div>
              <div className="field">
                <label htmlFor="rest">Rest sec</label>
                <input className="input" id="rest" min="0" name="rest" type="number" defaultValue="90" />
              </div>
            </div>
            <button className="button primary" type="submit">Complete Set</button>
          </form>
        </Modal>
      ) : null}

      {exerciseForm ? (
        <Modal title={exerciseForm.id ? "Edit Exercise" : "Add Exercise"} onClose={() => setExerciseForm(null)}>
          <form className="stack" onSubmit={saveExercise}>
            <div className="field">
              <label htmlFor="exercise-name">Name</label>
              <input className="input" id="exercise-name" required value={exerciseForm.name} onChange={(event) => setExerciseForm({ ...exerciseForm, name: event.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="muscle-group">Muscle group</label>
              <select className="select" id="muscle-group" value={exerciseForm.muscle_group} onChange={(event) => setExerciseForm({ ...exerciseForm, muscle_group: event.target.value as MuscleGroup })}>
                {MUSCLE_GROUPS.map((group) => <option key={group} value={group}>{formatMuscleGroup(group)}</option>)}
              </select>
            </div>
            <label className="row">
              <input type="checkbox" checked={exerciseForm.is_compound} onChange={(event) => setExerciseForm({ ...exerciseForm, is_compound: event.target.checked })} />
              Compound movement
            </label>
            <button className="button primary" type="submit">Save Exercise</button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
