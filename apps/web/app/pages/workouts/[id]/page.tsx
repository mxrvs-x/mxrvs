"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  emptyWorkouts,
  FormattedNotes,
  formatDate,
  formatWorkoutType,
  MiniStat,
  totalVolume,
  type Workout,
  type WorkoutSet,
} from "@/app/components/shared";
import { loadWebWorkouts, type SyncState } from "@/lib/webData";
import { appAlert, appToast } from "@/lib/sweetAlert";

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function groupSets(sets: WorkoutSet[]) {
  const grouped = new Map<string, WorkoutSet[]>();

  sets.forEach((set) => {
    grouped.set(set.exercise_id, [...(grouped.get(set.exercise_id) || []), set]);
  });

  return Array.from(grouped.values()).map((exerciseSets) =>
    [...exerciseSets].sort((a, b) => a.set_number - b.set_number),
  );
}

function buildWorkoutClipboardText(workout: Workout, groupedSets: WorkoutSet[][]) {
  const lines = [
    `${formatWorkoutType(workout.workout_type)} Workout`,
    formatDate(workout.workout_date),
    "",
    `Duration: ${workout.duration_minutes || 0} min`,
    `Total Sets: ${workout.sets.length}`,
    `Total Volume: ${totalVolume(workout).toLocaleString()} kg`,
  ];

  if (workout.notes.trim()) {
    lines.push("", "Notes:", workout.notes.trim());
  }

  lines.push("", "Exercises:");

  if (groupedSets.length === 0) {
    lines.push("No sets found.");
  } else {
    groupedSets.forEach((sets) => {
      const firstSet = sets[0];
      const exerciseVolume = sets.reduce(
        (sum, set) => sum + set.reps * set.weight_kg,
        0,
      );

      lines.push(
        "",
        `${firstSet.exercise_name}`,
        `Sets: ${sets.length}`,
        `Volume: ${exerciseVolume.toLocaleString()} kg`,
      );

      sets.forEach((set) => {
        const setVolume = set.reps * set.weight_kg;
        lines.push(
          `- Set ${set.set_number}: ${set.reps} reps x ${
            set.weight_kg
          } kg (${setVolume.toLocaleString()} kg volume)`,
        );
      });
    });
  }

  return lines.join("\n");
}

export default function WorkoutDetailsPage() {
  const params = useParams();
  const workoutId = routeParam(params.id);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [workouts, setWorkouts] = useState<Workout[]>(emptyWorkouts);

  useEffect(() => {
    let active = true;

    loadWebWorkouts().then((data) => {
      if (!active) return;
      if (!data) {
        void appAlert(
          "Workout Load Failed",
          "Could not load this workout from Supabase.",
          "error",
        );
        return;
      }

      setWorkouts(data.workouts);
      setSyncState("supabase");
    });

    return () => {
      active = false;
    };
  }, []);

  const workout = workouts.find((item) => item.id === workoutId) || null;
  const groupedSets = useMemo(
    () => (workout ? groupSets(workout.sets) : []),
    [workout],
  );

  useEffect(() => {
    if (!workout) return;
    document.documentElement.dataset.workoutTheme = workout.workout_type;

    return () => {
      delete document.documentElement.dataset.workoutTheme;
    };
  }, [workout]);

  async function copyWorkoutDetails() {
    if (!workout) return;

    try {
      await navigator.clipboard.writeText(
        buildWorkoutClipboardText(workout, groupedSets),
      );
      await appToast("Workout details copied");
    } catch {
      await appAlert(
        "Copy Failed",
        "Could not copy workout details to clipboard.",
        "error",
      );
    }
  }

  if (!workout) {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Training</p>
            <h1>Workout Details</h1>
            <p className="muted">
              Data source:{" "}
              {syncState === "supabase" ? "Supabase" : "Waiting for session"}
            </p>
          </div>
          <Link className="button" href="/pages/workouts/history">
            <ArrowLeft size={18} aria-hidden="true" />
            History
          </Link>
        </header>
        <div className="card">
          <p className="muted">Workout not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workout</p>
          <h1>{formatWorkoutType(workout.workout_type)}</h1>
          <p className="muted">{formatDate(workout.workout_date)}</p>
        </div>
        <div className="row responsive">
          <button className="button" onClick={copyWorkoutDetails} type="button">
            <Copy size={18} aria-hidden="true" />
            Copy
          </button>
          <Link
            className="button"
            href={`/pages/workouts/history?split=${workout.workout_type}`}
          >
            <ArrowLeft size={18} aria-hidden="true" />
            History
          </Link>
        </div>
      </header>

      <section className="grid two-col">
        <div className="stack">
          <div className="card stack">
            <h2>Summary</h2>
            <div className="row wrap">
              <MiniStat
                label="Duration"
                value={`${workout.duration_minutes || 0} min`}
              />
              <MiniStat label="Sets" value={`${workout.sets.length}`} />
              <MiniStat
                label="Volume"
                value={`${totalVolume(workout).toLocaleString()} kg`}
              />
            </div>
          </div>

          <div className="card stack">
            <h2>Notes</h2>
            <FormattedNotes notes={workout.notes} fallback="No notes saved." />
          </div>
        </div>

        <div className="stack log-panel">
          <div className="row between">
            <h2>Exercises</h2>
            <strong className="muted">{groupedSets.length}</strong>
          </div>

          <div className="stack log-scroll">
            {groupedSets.length === 0 ? (
              <div className="card">
                <p className="muted">No sets found.</p>
              </div>
            ) : null}

            {groupedSets.map((sets) => {
              const firstSet = sets[0];
              const exerciseVolume = sets.reduce(
                (sum, set) => sum + set.reps * set.weight_kg,
                0,
              );

              return (
                <article className="list-item stack" key={firstSet.exercise_id}>
                  <div className="row between">
                    <div>
                      <h3>{firstSet.exercise_name}</h3>
                      <p className="muted">
                        {sets.length} sets -{" "}
                        {exerciseVolume.toLocaleString()} kg volume
                      </p>
                    </div>
                  </div>
                  <div className="stack">
                    {sets.map((set) => (
                      <div className="panel row between" key={set.id}>
                        <strong>Set {set.set_number}</strong>
                        <span className="muted">
                          {set.reps} reps x {set.weight_kg} kg
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
