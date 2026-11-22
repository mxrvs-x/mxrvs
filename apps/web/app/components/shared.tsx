"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import type { ChartOptions } from "chart.js";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
);

export type WorkoutType =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "arms"
  | "rest";
export type MuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core";

export type Exercise = {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  is_compound: boolean;
};

export type WorkoutSet = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rest_seconds: number;
};

export type RecoveryCheckIn = {
  recovery_energy: number | null;
  recovery_sleep_quality: number | null;
  recovery_soreness: number | null;
  recovery_motivation: number | null;
  recovery_stress: number | null;
};

export type RecoveryMetricKey = keyof RecoveryCheckIn;

export const RECOVERY_METRICS: Array<{
  key: RecoveryMetricKey;
  label: string;
  hint: string;
}> = [
  { key: "recovery_energy", label: "Energy", hint: "1 low · 5 high" },
  {
    key: "recovery_sleep_quality",
    label: "Sleep Quality",
    hint: "1 poor · 5 excellent",
  },
  { key: "recovery_soreness", label: "Soreness", hint: "1 none · 5 severe" },
  { key: "recovery_motivation", label: "Motivation", hint: "1 low · 5 high" },
  { key: "recovery_stress", label: "Stress", hint: "1 low · 5 high" },
];

export function createRecoveryCheckIn(defaultScore: number | null = null) {
  return {
    recovery_energy: defaultScore,
    recovery_sleep_quality: defaultScore,
    recovery_soreness: defaultScore,
    recovery_motivation: defaultScore,
    recovery_stress: defaultScore,
  } satisfies RecoveryCheckIn;
}

export function recoveryCheckInLines(checkIn: Partial<RecoveryCheckIn>) {
  return RECOVERY_METRICS.flatMap((metric) => {
    const score = checkIn[metric.key];
    return typeof score === "number" ? [`${metric.label}: ${score}/5`] : [];
  });
}

export type Workout = RecoveryCheckIn & {
  id: string;
  workout_date: string;
  workout_type: WorkoutType;
  notes: string;
  duration_minutes: number;
  created_at: string;
  sets: WorkoutSet[];
};

export type CardioSession = {
  id: string;
  cardio_type: "walking" | "running";
  cardio_source: "outdoor" | "treadmill" | "manual";
  session_date: string;
  distance_km: number;
  duration_seconds: number;
  calories_burned: number;
  steps: number;
  notes: string;
};

export type CreatineLog = {
  id: string;
  date: string;
  grams: number;
  created_at: string;
};

export type BodyWeightLog = {
  id: string;
  date: string;
  logged_at: string;
  weight_kg: number;
  body_fat_percent: number | null;
};

export type ProfileState = {
  email: string;
  display_name: string;
  height_cm: number | null;
  weightLogs: BodyWeightLog[];
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
];

export const WORKOUT_PLANS = [
  { type: "push" as const, label: "Push", short: "P" },
  { type: "pull" as const, label: "Pull", short: "P" },
  { type: "legs" as const, label: "Legs", short: "L" },
  { type: "upper" as const, label: "Upper Body", short: "U" },
  { type: "lower" as const, label: "Lower", short: "L" },
  { type: "arms" as const, label: "Arms", short: "A" },
];

export function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function paceText(distanceKm: number, seconds: number) {
  if (!distanceKm || !seconds) return "-";
  const pace = seconds / 60 / distanceKm;
  const min = Math.floor(pace);
  const sec = Math.round((pace - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

export function formatWorkoutType(type: WorkoutType) {
  if (type === "rest") return "Rest";
  return WORKOUT_PLANS.find((plan) => plan.type === type)?.label || "Workout";
}

export function isWorkoutType(value: unknown): value is WorkoutType {
  return (
    value === "push" ||
    value === "pull" ||
    value === "legs" ||
    value === "upper" ||
    value === "lower" ||
    value === "arms" ||
    value === "rest"
  );
}

export function formatMuscleGroup(group: string) {
  return group
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const SPLIT_MUSCLE_GROUPS: Record<Exclude<WorkoutType, "rest">, MuscleGroup[]> = {
  push: ["chest", "back", "shoulders", "arms"],
  pull: ["chest", "back", "shoulders", "arms"],
  legs: ["legs", "core"],
  upper: ["chest", "back", "shoulders", "arms"],
  lower: ["legs", "arms", "core"],
  arms: ["arms"],
};

export function isExerciseRecommendedForWorkout(
  exercise: Exercise,
  type: WorkoutType,
) {
  if (type === "rest") return false;

  return SPLIT_MUSCLE_GROUPS[type].includes(exercise.muscle_group);
}

export function noteLines(notes: string) {
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function FormattedNotes({
  notes,
  fallback,
}: {
  notes: string;
  fallback?: string;
}) {
  const lines = noteLines(notes);

  if (lines.length === 0) {
    return fallback ? <p className="muted">{fallback}</p> : null;
  }

  if (lines.length === 1) {
    return <p className="muted">{lines[0]}</p>;
  }

  return (
    <ul className="notes-list">
      {lines.map((line, index) => (
        <li key={`${line}-${index}`}>{line}</li>
      ))}
    </ul>
  );
}

export function totalVolume(workout: Workout) {
  return workout.sets.reduce((sum, set) => sum + set.reps * set.weight_kg, 0);
}

export function useLocalState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored) {
      try {
        setValue(JSON.parse(stored) as T);
      } catch {
        setValue(initialValue);
      }
    }
    setReady(true);
  }, [initialValue, key]);

  useEffect(() => {
    if (ready) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, ready, value]);

  return [value, setValue, ready] as const;
}

export const emptyExercises: Exercise[] = [];
export const emptyWorkouts: Workout[] = [];
export const emptyCardio: CardioSession[] = [];
export const emptyCreatine: CreatineLog[] = [];
export const emptyProfile: ProfileState = {
  email: "",
  display_name: "Profile",
  height_cm: null,
  weightLogs: [],
};

type ActivityCalendarProps = {
  activeDates: Record<string, unknown>;
  marker: string;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  title?: string;
  onVisibleMonthChange?: (month: number, year: number) => void;
  children?: React.ReactNode;
};

const WEEK_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function ActivityCalendar({
  activeDates,
  marker,
  selectedDate,
  onSelectDate,
  title = "This Week",
  onVisibleMonthChange,
  children,
}: ActivityCalendarProps) {
  const now = new Date();
  const today = toDateKey(now);
  const [expanded, setExpanded] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());

  useEffect(() => {
    onVisibleMonthChange?.(calendarMonth, calendarYear);
  }, [calendarMonth, calendarYear, onVisibleMonthChange]);

  const weekDays = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date: toDateKey(date), day: date.getDate(), label: WEEK_LABELS[index] };
    });
  }, []);

  const monthDays = useMemo(() => {
    const first = new Date(calendarYear, calendarMonth, 1);
    const last = new Date(calendarYear, calendarMonth + 1, 0);
    const days: Array<{ date: string | null; day: number | null }> = [];

    for (let i = 0; i < first.getDay(); i++) days.push({ date: null, day: null });
    for (let day = 1; day <= last.getDate(); day++) {
      days.push({ date: toDateKey(new Date(calendarYear, calendarMonth, day)), day });
    }

    return days;
  }, [calendarMonth, calendarYear]);

  function changeMonth(direction: -1 | 1) {
    const next = new Date(calendarYear, calendarMonth, 1);
    next.setMonth(next.getMonth() + direction);
    setCalendarMonth(next.getMonth());
    setCalendarYear(next.getFullYear());
  }

  const monthTitle = new Date(calendarYear, calendarMonth, 1).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });

  return (
    <section className="card calendar">
      {!expanded ? (
        <>
          <div className="row between">
            <h2>{title}</h2>
            <button className="icon-button" onClick={() => setExpanded(true)} title="Expand calendar" type="button">
              <Maximize2 size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="calendar-days">
            {weekDays.map((item) => (
              <button
                className={[
                  "day-cell",
                  item.date === today ? "today" : "",
                  item.date === selectedDate ? "selected" : "",
                ].join(" ")}
                key={item.date}
                onClick={() => onSelectDate(item.date)}
                type="button"
              >
                <small>{item.label}</small>
                <span>{item.day}</span>
                <span className="marker">{activeDates[item.date] ? marker : ""}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="row between">
            <button className="icon-button" onClick={() => changeMonth(-1)} title="Previous month" type="button">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <h2>{monthTitle}</h2>
            <button className="icon-button" onClick={() => changeMonth(1)} title="Next month" type="button">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="calendar-weekdays">
            {WEEK_LABELS.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
          <div className="calendar-days">
            {monthDays.map((item, index) =>
              item.date ? (
                <button
                  className={[
                    "day-cell",
                    item.date === today ? "today" : "",
                    item.date === selectedDate ? "selected" : "",
                  ].join(" ")}
                  key={item.date}
                  onClick={() => onSelectDate(item.date as string)}
                  type="button"
                >
                  <span>{item.day}</span>
                  <span className="marker">{activeDates[item.date] ? marker : ""}</span>
                </button>
              ) : (
                <span className="day-cell empty" key={`empty-${index}`} />
              ),
            )}
          </div>
          <button className="button ghost" onClick={() => setExpanded(false)} type="button">
            <X size={18} aria-hidden="true" />
            Collapse
          </button>
        </>
      )}
      {children}
    </section>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal stack">
        <div className="row between">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} title="Close" type="button">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useChartOptions(): ChartOptions<"bar" | "line"> {
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    const refreshTheme = () => setThemeVersion((current) => current + 1);
    window.addEventListener("mxrvs-theme-change", refreshTheme);
    return () => window.removeEventListener("mxrvs-theme-change", refreshTheme);
  }, []);

  void themeVersion;
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: cssVar("--text-muted"), boxWidth: 12 } },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { ticks: { color: cssVar("--text-muted") }, grid: { color: "transparent" } },
      y: { ticks: { color: cssVar("--text-muted") }, grid: { color: cssVar("--border") } },
    },
  };
}

function cssVar(name: string) {
  if (typeof window === "undefined") return "#64748b";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function WorkoutVolumeChart({ workouts }: { workouts: Workout[] }) {
  const options = useChartOptions();
  const visible = Array.from(
    workouts.reduce<
      Map<string, { workout_date: string; volume: number; sets: number }>
    >((days, workout) => {
      const current = days.get(workout.workout_date) || {
        workout_date: workout.workout_date,
        volume: 0,
        sets: 0,
      };

      current.volume += totalVolume(workout);
      current.sets += workout.sets.length;
      days.set(workout.workout_date, current);
      return days;
    }, new Map()),
  )
    .map(([, day]) => day)
    .sort((a, b) => a.workout_date.localeCompare(b.workout_date))
    .slice(-10);

  if (visible.length === 0) {
    return <p className="muted">Complete a workout to see progress here.</p>;
  }

  if (visible.every((day) => day.sets === 0)) {
    return <p className="muted">No logged workout sets to chart yet.</p>;
  }

  const data = {
    labels: visible.map((workout) => formatShortDate(workout.workout_date)),
    datasets: [
      {
        label: "Volume kg",
        data: visible.map((day) => day.volume),
        backgroundColor: cssVar("--primary"),
        borderRadius: 6,
        minBarLength: 2,
        yAxisID: "volume",
      },
      {
        label: "Sets",
        data: visible.map((day) => day.sets),
        backgroundColor: cssVar("--info"),
        borderRadius: 6,
        minBarLength: 2,
        yAxisID: "sets",
      },
    ],
  };

  const workoutOptions: ChartOptions<"bar"> = {
    ...(options as ChartOptions<"bar">),
    scales: {
      x: options.scales?.x,
      volume: {
        beginAtZero: true,
        position: "left",
        ticks: { color: cssVar("--text-muted") },
        grid: { color: cssVar("--border") },
        title: { display: true, text: "Volume (kg)", color: cssVar("--text-muted") },
      },
      sets: {
        beginAtZero: true,
        position: "right",
        ticks: { color: cssVar("--text-muted"), precision: 0 },
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Sets", color: cssVar("--text-muted") },
      },
    },
  };

  return (
    <Bar
      aria-label="Workout volume and sets over time"
      data={data}
      options={workoutOptions}
      redraw
      role="img"
    />
  );
}

export function CardioReportChart({ sessions }: { sessions: CardioSession[] }) {
  const options = useChartOptions();
  const visible = [...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date)).slice(-12);
  const data = {
    labels: visible.map((session) => formatShortDate(session.session_date)),
    datasets: [
      {
        label: "Distance km",
        data: visible.map((session) => session.distance_km),
        borderColor: cssVar("--running"),
        backgroundColor: "rgba(234, 88, 12, 0.15)",
        fill: true,
        tension: 0.35,
      },
      {
        label: "Minutes",
        data: visible.map((session) => Math.round(session.duration_seconds / 60)),
        borderColor: cssVar("--info"),
        backgroundColor: "rgba(56, 189, 248, 0.13)",
        fill: true,
        tension: 0.35,
      },
    ],
  };

  return <Line data={data} options={options as ChartOptions<"line">} />;
}

export function CreatineChart({ logs }: { logs: CreatineLog[] }) {
  const options = useChartOptions();
  const byWeek = logs.reduce<Record<string, number>>((acc, log) => {
    const date = new Date(`${log.date}T00:00:00`);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = toDateKey(weekStart);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const labels = Object.keys(byWeek).sort().slice(-8);
  const data = {
    labels: labels.map(formatShortDate),
    datasets: [
      {
        label: "Logged days",
        data: labels.map((label) => byWeek[label]),
        backgroundColor: cssVar("--primary"),
        borderRadius: 6,
      },
    ],
  };

  return <Bar data={data} options={options as ChartOptions<"bar">} />;
}

export function WeightChart({ logs }: { logs: BodyWeightLog[] }) {
  const options = useChartOptions();
  const visible = [...logs].sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
  const data = {
    labels: visible.map((log) => formatShortDate(log.date)),
    datasets: [
      {
        label: "Weight kg",
        data: visible.map((log) => log.weight_kg),
        borderColor: cssVar("--primary"),
        backgroundColor: "rgba(22, 163, 74, 0.14)",
        fill: true,
        tension: 0.35,
      },
      {
        label: "Body fat %",
        data: visible.map((log) => log.body_fat_percent ?? null),
        borderColor: cssVar("--accent"),
        backgroundColor: "rgba(249, 115, 22, 0.1)",
        fill: false,
        tension: 0.35,
      },
    ],
  };

  return <Line data={data} options={options as ChartOptions<"line">} />;
}
