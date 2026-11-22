"use client";

import Link from "next/link";
import { Play, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Pagination from "@/app/components/Pagination";
import {
  ActivityCalendar,
  emptyWorkouts,
  FormattedNotes,
  formatDate,
  formatWorkoutType,
  MiniStat,
  totalVolume,
  type Workout,
  WorkoutVolumeChart,
} from "@/app/components/shared";
import { loadWebWorkouts, type SyncState } from "@/lib/webData";
import { getStrengthPersonalRecords } from "@/lib/personalRecords";
import { appAlert } from "@/lib/sweetAlert";

const PAGE_SIZE = 8;

export default function WorkoutHistoryPage() {
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [workouts, setWorkouts] = useState<Workout[]>(emptyWorkouts);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedExerciseKey, setSelectedExerciseKey] = useState("");

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
  const totalPages = Math.max(
    1,
    Math.ceil(filteredWorkouts.length / PAGE_SIZE),
  );
  const paginatedWorkouts = filteredWorkouts.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const exerciseRecords = useMemo(() => {
    const grouped = new Map<
      string,
      Array<Workout["sets"][number]>
    >();

    workouts.forEach((workout) => {
      workout.sets.forEach((set) => {
        if (Number(set.reps) <= 0) return;
        const key = set.exercise_name.trim().toLowerCase() || set.exercise_id;
        grouped.set(key, [...(grouped.get(key) || []), set]);
      });
    });

    return Array.from(grouped.entries())
      .map(([key, sets]) => ({
        key,
        name: sets[0]?.exercise_name || "Exercise",
        ...getStrengthPersonalRecords(sets),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [workouts]);
  const selectedExerciseRecord =
    exerciseRecords.find((record) => record.key === selectedExerciseKey) ||
    exerciseRecords[0] ||
    null;

  useEffect(() => {
    setPage(1);
  }, [selectedDate]);

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
            href="/pages/workouts/setup"
          >
            <Settings size={18} aria-hidden="true" />
            Setup
          </Link>
          <Link
            className="button primary"
            href="/pages/workouts/session"
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
            {selectedExerciseRecord ? (
              <div className="stack" style={{ marginTop: 16 }}>
                <div className="field">
                  <label htmlFor="workout-pr-exercise">Exercise PR</label>
                  <select
                    className="select"
                    id="workout-pr-exercise"
                    onChange={(event) => setSelectedExerciseKey(event.target.value)}
                    value={selectedExerciseRecord.key}
                  >
                    {exerciseRecords.map((record) => (
                      <option key={record.key} value={record.key}>
                        {record.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row wrap">
                  <MiniStat
                    label={
                      Number(selectedExerciseRecord.weight?.weight_kg) > 0
                        ? "Weight PR"
                        : "Rep PR"
                    }
                    value={
                      selectedExerciseRecord.weight
                        ? Number(selectedExerciseRecord.weight.weight_kg) > 0
                          ? `${selectedExerciseRecord.weight.weight_kg} kg`
                          : `${selectedExerciseRecord.weight.reps} reps`
                        : "--"
                    }
                  />
                  <MiniStat
                    label={
                      Number(selectedExerciseRecord.weight?.weight_kg) > 0
                        ? "Reps at PR"
                        : "Exercise"
                    }
                    value={
                      selectedExerciseRecord.weight
                        ? Number(selectedExerciseRecord.weight.weight_kg) > 0
                          ? `${selectedExerciseRecord.weight.reps}`
                          : "Bodyweight"
                        : "--"
                    }
                  />
                </div>
              </div>
            ) : null}
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

            {paginatedWorkouts.map((workout) => (
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
              </Link>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </section>
    </div>
  );
}
