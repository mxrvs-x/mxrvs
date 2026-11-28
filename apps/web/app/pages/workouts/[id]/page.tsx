"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  emptyWorkouts,
  FormattedNotes,
  formatDate,
  formatWorkoutType,
  MiniStat,
  recoveryCheckInLines,
  RECOVERY_METRICS,
  totalVolume,
  type Workout,
  type WorkoutSet,
} from "@/app/components/shared";
import {
  deleteWebWorkout,
  loadWebWorkoutDetails,
  type SyncState,
} from "@/lib/webData";
import { appAlert, appConfirm, appToast } from "@/lib/sweetAlert";

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

  const recoveryLines = recoveryCheckInLines(workout);
  if (recoveryLines.length > 0) {
    lines.push("", "Recovery Check-in:", ...recoveryLines);
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
  const router = useRouter();
  const workoutId = routeParam(params.id);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [workouts, setWorkouts] = useState<Workout[]>(emptyWorkouts);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    if (!workoutId) return;

    loadWebWorkoutDetails(workoutId).then((data) => {
      if (!active) return;
      if (!data) {
        void appAlert(
          "Workout Load Failed",
          "Could not load this workout from Supabase.",
          "error",
        );
        return;
      }

      setWorkouts([data]);
      setSyncState("supabase");
    });

    return () => {
      active = false;
    };
  }, [workoutId]);

  const workout = workouts.find((item) => item.id === workoutId) || null;
  const groupedSets = useMemo(
    () => (workout ? groupSets(workout.sets) : []),
    [workout],
  );

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

  async function deleteWorkout() {
    if (!workout || deleting) return;

    const confirmed = await appConfirm({
      title: "Delete Workout?",
      text: "This permanently deletes the workout and all of its logged sets.",
      confirmButtonText: "Delete Workout",
      icon: "warning",
    });
    if (!confirmed) return;

    setDeleting(true);
    const deleted = await deleteWebWorkout(workout.id);
    if (!deleted) {
      setDeleting(false);
      await appAlert(
        "Delete Failed",
        "Could not delete this workout. Please try again.",
        "error",
      );
      return;
    }

    await appToast("Workout deleted");
    router.push("/pages/workouts/history");
    router.refresh();
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

  const recovery = RECOVERY_METRICS.filter(({ key }) => typeof workout[key] === "number");

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workout</p>
          <h1>{formatWorkoutType(workout.workout_type)}</h1>
          <time className="muted workout-date" dateTime={workout.workout_date}>{formatDate(workout.workout_date)}</time>
        </div>
        <div className="row responsive">
          <button className="button" onClick={copyWorkoutDetails} type="button">
            <Copy size={18} aria-hidden="true" />
            Copy
          </button>
          <button
            className="button danger"
            disabled={deleting}
            onClick={deleteWorkout}
            type="button"
          >
            <Trash2 size={18} aria-hidden="true" />
            {deleting ? "Deleting..." : "Delete"}
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

      <div className={`grid workout-review${recovery.length > 0 || workout.notes.trim() ? " has-sidebar" : ""}`}>
        <section className="card stack workout-summary" aria-labelledby="workout-summary-title">
          <h2 id="workout-summary-title">Summary</h2>
          <div className="row wrap">
            <MiniStat label="Duration" value={`${workout.duration_minutes || 0} min`} />
            <MiniStat label="Sets" value={`${workout.sets.length}`} />
            <MiniStat label="Volume" value={`${totalVolume(workout).toLocaleString()} kg`} />
          </div>
        </section>

        <section className="stack" aria-labelledby="workout-exercises-title">
          <h2 id="workout-exercises-title">Exercises <span className="muted record-count">({groupedSets.length})</span></h2>
          {groupedSets.length === 0 && <div className="card muted">No sets found.</div>}
          {groupedSets.map((sets) => {
            const firstSet = sets[0];
            const volume = sets.reduce((sum, set) => sum + set.reps * set.weight_kg, 0);
            const titleId = `exercise-${firstSet.exercise_id}`;

            return (
              <article className="card stack" key={firstSet.exercise_id}>
                <div className="row between wrap">
                  <h3 id={titleId}>{firstSet.exercise_name}</h3>
                  <span className="muted">{volume.toLocaleString()} kg volume</span>
                </div>
                <table className="records-table workout-set-table" aria-labelledby={titleId}>
                  <thead>
                    <tr>
                      <th scope="col">Set</th>
                      <th scope="col">Reps</th>
                      <th scope="col">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((set) => (
                      <tr key={set.id}>
                        <th scope="row">{set.set_number}</th>
                        <td>{set.reps}</td>
                        <td>{set.weight_kg} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            );
          })}
        </section>

        {(recovery.length > 0 || workout.notes.trim()) && (
          <div className="stack">
            {recovery.length > 0 && (
              <section className="card stack">
                <h2>Recovery check-in</h2>
                <div className="workout-recovery">
                  {recovery.map(({ key, label }) => (
                    <MiniStat key={key} label={label} value={`${workout[key]}/5`} />
                  ))}
                </div>
              </section>
            )}
            {workout.notes.trim() && (
              <section className="card stack">
                <h2>Notes</h2>
                <FormattedNotes notes={workout.notes} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
