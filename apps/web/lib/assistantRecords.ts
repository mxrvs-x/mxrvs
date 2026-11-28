import type { SupabaseClient } from "@supabase/supabase-js";
import { isSleepDate, summarizeSleep, type SleepEntry } from "../../mobile/lib/sleep";

const MAX_ROWS = 500;
const MAX_DETAILS = 14;
const MAX_SETS_PER_WORKOUT = 20;
const workoutSplits = ["push", "pull", "legs", "upper", "lower", "arms", "rest"];

const datasets = {
  workouts: {
    table: "workouts", date: "workout_date", typeColumn: "workout_type",
    types: workoutSplits,
    columns: "workout_date,workout_type,duration_minutes,recovery_energy,recovery_sleep_quality,recovery_soreness,recovery_motivation,recovery_stress,workout_sets(set_number,reps,weight_kg,exercises(name))",
    metrics: ["duration_minutes", "recovery_energy", "recovery_sleep_quality", "recovery_soreness", "recovery_motivation", "recovery_stress"],
    order: ["created_at", "id"],
  },
  exercise: {
    table: "workout_sets", date: "workouts.workout_date", typeColumn: "workouts.workout_type",
    types: workoutSplits,
    columns: "set_number,reps,weight_kg,workouts!inner(workout_date,workout_type),exercises!inner(name)",
    metrics: ["weight_kg", "reps"],
    order: ["created_at", "id"],
  },
  cardio: {
    table: "cardio_sessions", date: "session_date", typeColumn: "cardio_type",
    types: ["walking", "running"],
    columns: "session_date,cardio_type,cardio_source,distance_km,duration_seconds,steps,calories_burned,avg_heart_rate",
    metrics: ["distance_km", "duration_seconds", "steps", "calories_burned", "avg_heart_rate"],
    order: ["created_at", "id"],
  },
  activity: {
    table: "overall_activity", date: "activity_date",
    columns: "activity_date,steps,duration_seconds,calories_burned",
    metrics: ["steps", "duration_seconds", "calories_burned"],
    order: [],
  },
  macros: {
    table: "daily_macro_logs", date: "log_date",
    columns: "log_date,calories,protein_g,carbs_g,fat_g",
    metrics: ["calories", "protein_g", "carbs_g", "fat_g"],
    order: [],
  },
  sleep: {
    table: "sleep_logs", date: "log_date",
    columns: "log_date,time_zone,bedtime_at,sleep_onset_at,onset_approximate,final_wake_at,recorded_total_minutes,awakening_tracking,sleep_awakenings(position,woke_at,woke_approximate,resumed_at,resumed_approximate,resume_type,deduct_from_sleep),sleep_naps(started_at,ended_at)",
    metrics: ["total_sleep_minutes", "overnight_minutes", "deducted_awake_minutes", "nap_minutes"],
    order: [],
  },
  weight: {
    table: "body_weight_logs", date: "date",
    columns: "date,weight_kg,body_fat_percent",
    metrics: ["weight_kg", "body_fat_percent"],
    order: ["logged_at", "id"],
  },
  profile: {
    table: "body_stats", date: "updated_at",
    columns: "height_cm",
    metrics: [],
    order: ["created_at", "id"],
  },
  creatine: {
    table: "creatine_logs", date: "date",
    columns: "date,grams",
    metrics: ["grams"],
    order: [],
  },
} satisfies Record<string, {
  table: string; date: string; typeColumn?: string; types?: string[];
  columns: string; metrics: string[]; order: string[];
}>;

type Dataset = keyof typeof datasets;
type RecordQuery = {
  dataset: Dataset;
  from?: string;
  through?: string;
  type?: string;
  exercise?: string;
  highest?: string;
  bodyweight_only?: boolean;
};

export const recordsTool = {
  type: "function",
  function: {
    name: "find_fitness_records",
    description: "Fetch dated fitness records and numeric summaries from the signed-in user's mxrvs history. Request up to five queries, including different date ranges for comparisons.",
    parameters: {
      type: "object",
      required: ["queries"],
      additionalProperties: false,
      properties: {
        queries: {
          type: "array", minItems: 1, maxItems: 5,
          items: {
            type: "object",
            required: ["dataset"],
            additionalProperties: false,
            properties: {
              dataset: { type: "string", enum: Object.keys(datasets), description: "activity is daily pedometer totals. cardio is logged walk/run sessions. exercise is workout sets, including average load across all sets or a named exercise. workouts is session duration and recovery scores. profile returns the latest logged height and accepts no date filters." },
              from: { type: "string", description: "Inclusive start date in YYYY-MM-DD. Omit for all historical dates." },
              through: { type: "string", description: "Inclusive end date in YYYY-MM-DD. Omit for all dates." },
              type: { type: "string", description: "Optional workout split (push, pull, legs, upper, lower, arms, rest) or cardio type (walking, running)." },
              exercise: { type: "string", description: "Optional name filter for the exercise dataset, e.g. bench press. Omit to search sets across all exercises." },
              highest: { type: "string", description: "Optional metric to sort highest first. For an exercise PR use weight_kg (ties by reps), or reps for a rep record. For cardio use distance_km, steps, or duration_seconds. For non-ranked requests omit this field." },
              bodyweight_only: { type: "boolean", description: "For exercise queries only. Set to true when the user specifically asks for sets recorded at 0 kg." },
            },
          },
        },
      },
    },
  },
} as const;

function parseQuery(value: unknown): RecordQuery | null {
  if (!value || typeof value !== "object") return null;
  const { dataset, from, through, type, exercise, highest, bodyweight_only } = value as Record<string, unknown>;
  if (typeof dataset !== "string" || !Object.hasOwn(datasets, dataset)) return null;
  const key = dataset as Dataset;
  const config = datasets[key];
  if (key === "profile" && (from !== undefined || through !== undefined)) return null;
  if (from !== undefined && (typeof from !== "string" || !isSleepDate(from))) return null;
  if (through !== undefined && (typeof through !== "string" || !isSleepDate(through))) return null;
  if (from && through && from > through) return null;
  if (type !== undefined && (typeof type !== "string" || !("types" in config) || !config.types.includes(type))) return null;
  let exerciseName: string | undefined;
  if (exercise !== undefined) {
    if (key !== "exercise" || typeof exercise !== "string" || !exercise.trim() || exercise.length > 80) return null;
    exerciseName = exercise.trim();
  }
  if (highest !== undefined && (typeof highest !== "string" || !config.metrics.some((metric) => metric === highest))) return null;
  if (bodyweight_only !== undefined && (key !== "exercise" || typeof bodyweight_only !== "boolean")) return null;
  return { dataset: key, from, through, type, exercise: exerciseName, highest, bodyweight_only };
}

type Row = Record<string, unknown>;

function compactRows(dataset: Dataset, rows: Row[]): Row[] {
  if (dataset === "sleep") return rows.map((row) => {
    const entry = row as SleepEntry;
    const summary = summarizeSleep(entry);
    return {
      log_date: entry.log_date, time_zone: entry.time_zone, bedtime_at: entry.bedtime_at,
      sleep_onset_at: entry.sleep_onset_at, onset_approximate: entry.onset_approximate, final_wake_at: entry.final_wake_at,
      total_sleep_minutes: summary.total, total_kind: summary.totalLabel, overnight_minutes: summary.overnight,
      deducted_awake_minutes: summary.awake, nap_minutes: summary.naps, awakenings_reported: summary.awakenings,
      awakenings: entry.sleep_awakenings, naps: entry.sleep_naps,
    };
  });
  if (dataset === "workouts") return rows.map(({ workout_sets, ...row }) => {
    const sets = Array.isArray(workout_sets) ? workout_sets : [];
    return {
      ...row,
      sets: sets.slice(0, MAX_SETS_PER_WORKOUT),
      sets_truncated: sets.length > MAX_SETS_PER_WORKOUT,
    };
  });
  return rows;
}

function summarizeMetrics(rows: Row[], metrics: readonly string[]) {
  return Object.fromEntries(metrics.flatMap((key) => {
    const values = rows.map((row) => row[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!values.length) return [];
    const total = values.reduce((sum, value) => sum + value, 0);
    return [[key, { count: values.length, sum: Math.round(total * 100) / 100, average: Math.round(total / values.length * 100) / 100, min: Math.min(...values), max: Math.max(...values) }]];
  }));
}

function summarizeSetLoads(rows: Row[]) {
  const loads = rows.map(({ weight_kg: load, reps }) => ({
    loaded_weight_kg: typeof load === "number" && load > 0 ? load : null,
    volume_kg: typeof load === "number" && typeof reps === "number" ? load * reps : null,
  }));
  return summarizeMetrics(loads, ["loaded_weight_kg", "volume_kg"]);
}

function dailyCoverage(dataset: Dataset, rows: Row[], input: RecordQuery, complete: boolean) {
  if (input.highest || !["activity", "macros", "sleep", "weight", "creatine"].includes(dataset)) return;
  const column = datasets[dataset].date;
  const observed = new Set(rows.map((row) => row[column]));
  let missingDates: string[] | undefined;
  if (complete && input.from && input.through) {
    const start = Date.parse(input.from);
    const end = Date.parse(input.through);
    const dayMs = 86_400_000;
    if (end - start < 62 * dayMs) {
      missingDates = [];
      for (let date = start; date <= end; date += dayMs) {
        const key = new Date(date).toISOString().slice(0, 10);
        if (!observed.has(key)) missingDates.push(key);
      }
    }
  }
  return { daysWithRecords: observed.size, missingDates };
}

async function loadRecords(client: SupabaseClient, userId: string, input: RecordQuery) {
  const config = datasets[input.dataset];
  const databaseRanked = Boolean(input.highest && input.dataset !== "sleep");
  const limit = input.dataset === "profile" ? 1 : databaseRanked ? MAX_DETAILS : MAX_ROWS;
  let query = client.from(config.table).select(config.columns, { count: "exact" }).eq("user_id", userId);
  if (input.from) query = query.gte(config.date, input.from);
  if (input.through) query = query.lte(config.date, input.through);
  if (input.type && "typeColumn" in config) query = query.eq(config.typeColumn, input.type);
  if (input.exercise) {
    const name = input.exercise.replace(/[\\%_*]/g, "\\$&").replace(/\s+/g, "%");
    query = query.ilike("exercises.name", `%${name}%`);
  }
  if (input.bodyweight_only) query = query.eq("weight_kg", 0);
  if (input.dataset === "workouts") {
    query = query.order("set_number", { referencedTable: "workout_sets" })
      .order("id", { referencedTable: "workout_sets" })
      .limit(MAX_SETS_PER_WORKOUT + 1, { referencedTable: "workout_sets" });
  }
  if (input.highest && databaseRanked) {
    query = query.order(input.highest, { ascending: false, nullsFirst: false });
    if (input.dataset === "exercise" && input.highest === "weight_kg") {
      query = query.order("reps", { ascending: false, nullsFirst: false });
    }
  }
  const dateOrder = input.dataset === "exercise" ? "workouts(workout_date)" : config.date;
  query = query.order(dateOrder, { ascending: false, nullsFirst: false });
  for (const column of config.order) query = query.order(column, { ascending: false, nullsFirst: false });

  const { data, count, error } = await query.limit(limit).overrideTypes<Row[], { merge: false }>();
  if (error) return { query: input, error: "Could not read these records." };
  const rows = compactRows(input.dataset, data ?? []);
  const matched = count ?? rows.length;
  const complete = input.dataset === "profile" || databaseRanked || matched <= rows.length;
  const dailyRows = input.dataset === "weight" && !input.highest
    ? rows.filter((row, index) => index === 0 || row.date !== rows[index - 1].date)
    : rows;
  const metric = input.highest;
  const ranked = metric && !databaseRanked
    ? rows.filter((row) => typeof row[metric] === "number")
      .sort((a, b) => Number(b[metric]) - Number(a[metric]))
    : dailyRows;
  const details = ranked.slice(0, input.dataset === "workouts" ? 5 : MAX_DETAILS);
  return {
    query: input,
    matched,
    rowsExamined: rows.length,
    complete,
    coverage: dailyCoverage(input.dataset, rows, input, complete),
    summary: input.highest ? undefined : {
      ...summarizeMetrics(dailyRows, config.metrics),
      ...(input.dataset === "exercise" ? summarizeSetLoads(rows) : {}),
    },
    detailRowsShown: details.length,
    rows: details,
  };
}

export async function retrieveFitnessRecords(client: SupabaseClient, userId: string, args: string) {
  let queries: unknown;
  try {
    if (args.length <= 6_000) queries = JSON.parse(args)?.queries;
  } catch {
    return { error: "Invalid records query." };
  }
  if (!Array.isArray(queries) || queries.length < 1 || queries.length > 5) return { error: "Invalid records query." };

  return Promise.all(queries.map(async (value) => {
    const query = parseQuery(value);
    if (!query) return { error: "Invalid records query." };
    try {
      return await loadRecords(client, userId, query);
    } catch {
      return { query, error: "Could not read these records." };
    }
  }));
}
