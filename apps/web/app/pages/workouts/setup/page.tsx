"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { History, Pencil, Play, Plus, Trash2 } from "lucide-react";
import {
  emptyExercises,
  formatMuscleGroup,
  getTodayWorkoutPlan,
  isWorkoutType,
  Modal,
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
  type WorkoutType,
} from "@/app/components/shared";
import {
  deleteWebExercise,
  dedupeWebExercises,
  loadWebWorkouts,
  saveWebExercise,
  type SyncState,
} from "@/lib/webData";
import { appAlert, appConfirm, appToast } from "@/lib/sweetAlert";

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

export default function WorkoutSetupPage() {
  const params = useSearchParams();
  const suggested = useMemo(() => getTodayWorkoutPlan(), []);
  const routeSplit = params.get("split");
  const currentSplit: WorkoutType = isWorkoutType(routeSplit)
    ? routeSplit
    : suggested.type;
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [exercises, setExercises] = useState<Exercise[]>(emptyExercises);
  const [filter, setFilter] = useState<"all" | MuscleGroup>("all");
  const [exerciseForm, setExerciseForm] = useState<ExerciseForm | null>(null);

  useEffect(() => {
    document.documentElement.dataset.workoutTheme = currentSplit;

    return () => {
      delete document.documentElement.dataset.workoutTheme;
    };
  }, [currentSplit]);

  useEffect(() => {
    let active = true;

    loadWebWorkouts().then((data) => {
      if (!active) return;
      if (!data) {
        void appAlert(
          "Exercise Load Failed",
          "Could not load your exercise library from Supabase.",
          "error",
        );
        return;
      }
      setExercises(data.exercises);
      setSyncState("supabase");
    });

    return () => {
      active = false;
    };
  }, []);

  const groupedExercises = useMemo(() => {
    const visible =
      filter === "all"
        ? exercises
        : exercises.filter((exercise) => exercise.muscle_group === filter);

    return MUSCLE_GROUPS.map(
      (group) =>
        [
          group,
          visible
            .filter((exercise) => exercise.muscle_group === group)
            .sort(
              (a, b) =>
                Number(b.is_compound) - Number(a.is_compound) ||
                a.name.localeCompare(b.name),
            ),
        ] as const,
    ).filter(([, groupExercises]) => groupExercises.length > 0);
  }, [exercises, filter]);

  async function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exerciseForm?.name.trim()) {
      await appAlert("Missing Name", "Please enter an exercise name.", "warning");
      return;
    }

    const savedExercise = await saveWebExercise(exerciseForm);
    if (!savedExercise) {
      await appAlert(
        "Exercise Not Saved",
        "Something went wrong while saving this exercise. Please try again.",
        "error",
      );
      return;
    }

    if (exerciseForm.id) {
      setExercises((current) =>
        dedupeWebExercises(
          current.map((exercise) =>
            exercise.id === exerciseForm.id ? savedExercise : exercise,
          ),
        ),
      );
    } else {
      setExercises((current) => dedupeWebExercises([...current, savedExercise]));
    }

    const refreshed = await loadWebWorkouts();
    if (refreshed) {
      setExercises(refreshed.exercises);
    }

    setExerciseForm(null);
    await appToast(exerciseForm.id ? "Exercise updated" : "Exercise added");
  }

  async function removeExercise(exercise: Exercise) {
    const confirmed = await appConfirm({
      title: "Delete Exercise?",
      text: `${exercise.name} will be removed from your exercise library.`,
      confirmButtonText: "Delete",
    });

    if (!confirmed) return;

    const deleted = await deleteWebExercise(exercise.id);
    if (!deleted) {
      await appAlert(
        "Delete Failed",
        "Could not delete this exercise. Please try again.",
        "error",
      );
      return;
    }

    setExercises((current) =>
      current.filter((item) => item.id !== exercise.id),
    );
    await appToast("Exercise deleted");
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Training</p>
          <h1>Exercise Setup</h1>
          <p className="muted">
            Data source:{" "}
            {syncState === "supabase" ? "Supabase" : "Waiting for session"}
          </p>
        </div>
        <div className="row responsive">
          <Link
            className="button"
            href={`/pages/workouts/history?split=${currentSplit}`}
          >
            <History size={18} aria-hidden="true" />
            History
          </Link>
          <Link
            className="button primary"
            href={`/pages/workouts/session?split=${currentSplit}`}
          >
            <Play size={18} aria-hidden="true" />
            Start
          </Link>
        </div>
      </header>

      <section className="stack">
        <div className="card row between responsive">
          <div>
            <p className="muted">Exercise Library by Muscle Group</p>
            <h2>{exercises.length} exercises</h2>
          </div>
          <button
            className="button primary"
            onClick={() => setExerciseForm(emptyExerciseForm)}
            type="button"
          >
            <Plus size={18} aria-hidden="true" />
            Add Exercise
          </button>
        </div>

        <div className="chips">
          {(["all", ...MUSCLE_GROUPS] as const).map((item) => (
            <button
              className={filter === item ? "chip active" : "chip"}
              key={item}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item === "all" ? "All" : formatMuscleGroup(item)}
            </button>
          ))}
        </div>

        {groupedExercises.length === 0 ? (
          <div className="card">
            <p className="muted">No exercises yet.</p>
          </div>
        ) : null}

        {groupedExercises.map(([group, groupExercises]) => (
          <div className="stack" key={group}>
            <h2>
              {formatMuscleGroup(group)} ({groupExercises.length})
            </h2>
            {groupExercises.map((exercise) => (
              <div
                className="list-item row between responsive"
                key={exercise.id}
              >
                <div>
                  <strong>{exercise.name}</strong>
                  <p className="muted">
                    {exercise.is_compound ? "Compound" : "Isolation"}
                  </p>
                </div>
                <div className="row exercise-actions">
                  <button
                    className="icon-button"
                    onClick={() => setExerciseForm(exercise)}
                    title="Edit exercise"
                    type="button"
                  >
                    <Pencil size={17} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => removeExercise(exercise)}
                    title="Delete exercise"
                    type="button"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {exerciseForm ? (
        <Modal
          title={exerciseForm.id ? "Edit Exercise" : "Add Exercise"}
          onClose={() => setExerciseForm(null)}
        >
          <form className="stack" onSubmit={saveExercise}>
            <div className="field">
              <label htmlFor="exercise-name">Name</label>
              <input
                className="input"
                id="exercise-name"
                onChange={(event) =>
                  setExerciseForm({ ...exerciseForm, name: event.target.value })
                }
                required
                value={exerciseForm.name}
              />
            </div>
            <div className="field">
              <label htmlFor="muscle-group">Muscle group</label>
              <select
                className="select"
                id="muscle-group"
                onChange={(event) =>
                  setExerciseForm({
                    ...exerciseForm,
                    muscle_group: event.target.value as MuscleGroup,
                  })
                }
                value={exerciseForm.muscle_group}
              >
                {MUSCLE_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {formatMuscleGroup(group)}
                  </option>
                ))}
              </select>
            </div>
            <label className="row">
              <input
                checked={exerciseForm.is_compound}
                onChange={(event) =>
                  setExerciseForm({
                    ...exerciseForm,
                    is_compound: event.target.checked,
                  })
                }
                type="checkbox"
              />
              Compound movement
            </label>
            <button className="button primary" type="submit">
              Save Exercise
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
