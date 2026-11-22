"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { History, Play, Settings } from "lucide-react";
import {
  emptyWorkouts,
  FormattedNotes,
  formatDate,
  formatWorkoutType,
  MiniStat,
  toDateKey,
  totalVolume,
  type Workout,
  type WorkoutType,
} from "@/app/components/shared";
import { loadWebWorkouts, type SyncState } from "@/lib/webData";
import { appAlert } from "@/lib/sweetAlert";

export default function WorkoutsPage() {
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [workouts, setWorkouts] = useState<Workout[]>(emptyWorkouts);
  const [todayWorkout, setTodayWorkout] = useState<{
    workout_type: WorkoutType;
    duration_minutes: number;
  } | null>(null);

  useEffect(() => {
    let active = true;

    loadWebWorkouts().then((data) => {
      if (!active) return;
      if (!data) {
        void appAlert(
          "Workouts Load Failed",
          "Could not load workouts from Supabase.",
          "error",
        );
        return;
      }

      const loadedWorkouts = data.workouts || emptyWorkouts;
      const workout = loadedWorkouts.find(
        (item) => item.workout_date === toDateKey(),
      );

      setWorkouts(loadedWorkouts);
      setTodayWorkout(
        workout
          ? {
              workout_type: workout.workout_type,
              duration_minutes: workout.duration_minutes,
            }
          : null,
      );
      setSyncState("supabase");
    });

    return () => {
      active = false;
    };
  }, []);

  const recentWorkouts = useMemo(() => {
    return [...workouts]
      .sort((a, b) => {
        const dateCompare = b.workout_date.localeCompare(a.workout_date);
        if (dateCompare !== 0) return dateCompare;
        return b.created_at.localeCompare(a.created_at);
      })
      .slice(0, 3);
  }, [workouts]);

  return (
    <div className="page workout-home">
      <header className="page-header">
        <div>
          <p className="eyebrow">Training</p>
          <h1>Workouts</h1>
          <p className="muted">
            Data source:{" "}
            {syncState === "supabase" ? "Supabase" : "Waiting for session"}
          </p>
        </div>
        <Link
          className="button"
          href="/pages/workouts/setup"
        >
          <Settings size={18} aria-hidden="true" />
          Setup Exercises
        </Link>
      </header>

      <section className="card stack suggested-workout">
        <p className="eyebrow">
          Start Training
        </p>
        <h2>Choose today&apos;s workout split</h2>
        <p>Select Push, Pull, Legs, Upper Body, Lower, or Arms before starting.</p>

        {todayWorkout ? (
          <div className="panel">
            <strong>Already logged today</strong>
            <span>
              {formatWorkoutType(todayWorkout.workout_type)} -{" "}
              {todayWorkout.duration_minutes} min
            </span>
          </div>
        ) : null}

        <Link
          className="button primary"
          href="/pages/workouts/session"
        >
          <Play size={18} aria-hidden="true" />
          Choose Split
        </Link>
      </section>

      <section className="card stack" style={{ marginTop: 16 }}>
        <div className="row between responsive">
          <div>
            <h2>Recent Workouts</h2>
            <p className="muted">Your last 3 completed sessions.</p>
          </div>
          <Link
            className="button"
            href="/pages/workouts/history"
          >
            <History size={18} aria-hidden="true" />
            View All
          </Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <div className="panel">
            <strong>No workouts yet</strong>
            <p className="muted">Start a session to see your history here.</p>
          </div>
        ) : null}

        {recentWorkouts.map((workout) => (
          <Link
            className="list-item stack"
            href={`/pages/workouts/${workout.id}`}
            key={workout.id}
          >
            <div className="row between">
              <div>
                <h3>{formatWorkoutType(workout.workout_type)}</h3>
                <p className="muted">
                  {formatDate(workout.workout_date)}
                </p>
              </div>
            </div>
            <FormattedNotes notes={workout.notes} fallback="Workout session" />
            <div className="row wrap">
              <MiniStat label="Duration" value={`${workout.duration_minutes} min`} />
              <MiniStat label="Sets" value={`${workout.sets.length}`} />
              <MiniStat
                label="Volume"
                value={`${totalVolume(workout).toLocaleString()} kg`}
              />
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
