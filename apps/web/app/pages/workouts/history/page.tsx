"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Play, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityCalendar,
  emptyWorkouts,
  formatDate,
  formatWorkoutType,
  getTodayWorkoutPlan,
  isWorkoutType,
  MiniStat,
  totalVolume,
  type WorkoutType,
  type Workout,
  WorkoutVolumeChart,
} from "@/app/components/shared";
import { loadWebWorkouts, type SyncState } from "@/lib/webData";
import { appAlert } from "@/lib/sweetAlert";

export default function WorkoutHistoryPage() {
  const params = useSearchParams();
  const suggested = useMemo(() => getTodayWorkoutPlan(), []);
  const routeSplit = params.get("split");
  const currentSplit: WorkoutType = isWorkoutType(routeSplit)
    ? routeSplit
    : suggested.type;
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [workouts, setWorkouts] = useState<Workout[]>(emptyWorkouts);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
          "History Load Failed",
          "Could not load workout history from Supabase.",
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

  const activeDates = useMemo(() => {
    return workouts.reduce<Record<string, number>>((acc, workout) => {
      acc[workout.workout_date] = (acc[workout.workout_date] || 0) + 1;
      return acc;
    }, {});
  }, [workouts]);

  const filteredWorkouts = useMemo(() => {
    const sorted = [...workouts].sort((a, b) => {
      const dateCompare = b.workout_date.localeCompare(a.workout_date);
      if (dateCompare !== 0) return dateCompare;
      return b.created_at.localeCompare(a.created_at);
    });

    return selectedDate
      ? sorted.filter((workout) => workout.workout_date === selectedDate)
      : sorted;
  }, [selectedDate, workouts]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Training</p>
          <h1>Workout History</h1>
          <p className="muted">
            Data source:{" "}
            {syncState === "supabase" ? "Supabase" : "Waiting for session"}
          </p>
        </div>
        <div className="row responsive">
          <Link
            className="button"
            href={`/pages/workouts/setup?split=${currentSplit}`}
          >
            <Settings size={18} aria-hidden="true" />
            Setup
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

      <section className="grid two-col">
        <div className="stack">
          <ActivityCalendar
            activeDates={activeDates}
            marker="W"
            selectedDate={selectedDate}
            onSelectDate={(date) =>
              setSelectedDate((current) => (current === date ? null : date))
            }
          >
            {selectedDate ? (
              <p className="muted">
                {activeDates[selectedDate] || 0} sessions on{" "}
                {formatDate(selectedDate)}
              </p>
            ) : null}
          </ActivityCalendar>

          <div className="card">
            <div className="row between">
              <h2>Progress Reports</h2>
              <strong className="muted">{workouts.length} total</strong>
            </div>
            <div className="chart-wrap">
              <WorkoutVolumeChart workouts={workouts} />
            </div>
          </div>
        </div>

        <div className="stack log-panel">
          <div className="row between">
            <h2>{selectedDate ? "Selected Date" : "All Workouts"}</h2>
            <strong className="muted">{filteredWorkouts.length}</strong>
          </div>

          <div className="stack log-scroll">
            {filteredWorkouts.length === 0 ? (
              <div className="card">
                <p className="muted">
                  {selectedDate
                    ? "No workout sessions on this date."
                    : "No workout sessions yet."}
                </p>
              </div>
            ) : null}

            {filteredWorkouts.map((workout) => (
              <article className="list-item stack" key={workout.id}>
                <div className="row between">
                  <div>
                    <h3>{formatWorkoutType(workout.workout_type)}</h3>
                    <p className="muted">
                      {workout.notes || "Workout session"} -{" "}
                      {formatDate(workout.workout_date)}
                    </p>
                  </div>
                </div>
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
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
