import { createClient } from "@supabase/supabase-js";
import { retrieveFitnessRecords } from "../lib/assistantRecords";

const owner = "d8e50c67-b39c-4d2c-8ee5-ed5b53b454c8";

function database(rows: unknown[], count = rows.length) {
  const fetchRecords = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockImplementation(async () => Response.json(rows, {
    headers: { "Content-Range": `0-${rows.length - 1}/${count}` },
  }));
  const client = createClient("https://db.example", "publishable-key", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchRecords },
  });
  return { client, fetchRecords };
}

it("ranks weight before reps and scopes exercise sets and joined dates correctly", async () => {
  const { client, fetchRecords } = database([{
    weight_kg: 65, reps: 5, set_number: 1, exercises: { name: "Barbell Bench Press" },
    workouts: { workout_date: "2026-11-26", workout_type: "push" },
  }], 21);
  const result = await retrieveFitnessRecords(client, owner, JSON.stringify({
    queries: [{ dataset: "exercise", exercise: "bench press", from: "2026-11-01", highest: "weight_kg" }],
  }));

  const [resource, options] = fetchRecords.mock.calls[0];
  const url = new URL(String(resource));
  expect(url.pathname).toBe("/rest/v1/workout_sets");
  expect(options?.method).toBe("GET");
  expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
  expect(url.searchParams.get("workouts.workout_date")).toBe("gte.2026-11-01");
  expect(url.searchParams.get("exercises.name")).toBe("ilike.%bench%press%");
  expect(url.searchParams.get("order")).toMatch(/^weight_kg\.desc\.nullslast,reps\.desc\.nullslast,workouts\(workout_date\)\.desc/);
  expect(result).toMatchObject([{ matched: 21, complete: true, rows: [{ weight_kg: 65, reps: 5 }] }]);
});

it("uses the app sleep calculation and rejects unlisted query fields used as metrics", async () => {
  const { client, fetchRecords } = database([{
    log_date: "2026-11-26", time_zone: "Asia/Manila", bedtime_at: null, onset_approximate: false,
    sleep_onset_at: "2026-11-25T22:00:00+08:00", final_wake_at: "2026-11-26T06:00:00+08:00",
    recorded_total_minutes: null, awakening_tracking: "complete", sleep_naps: [],
    sleep_awakenings: [{
      woke_at: "2026-11-26T03:00:00+08:00", resumed_at: "2026-11-26T03:30:00+08:00",
      deduct_from_sleep: true,
    }],
  }]);
  const result = await retrieveFitnessRecords(client, owner, JSON.stringify({
    queries: [{ dataset: "sleep" }, { dataset: "cardio", highest: "user_id" }],
  }));

  expect(result).toMatchObject([
    { summary: { total_sleep_minutes: { average: 450 } }, rows: [{ deducted_awake_minutes: 30 }] },
    { error: "Invalid records query." },
  ]);
  expect(fetchRecords).toHaveBeenCalledTimes(1);
});

it("calculates average load across exercises, distinguishing zero and missing weights", async () => {
  const { client, fetchRecords } = database([
    { weight_kg: 40, reps: 10 },
    { weight_kg: 50, reps: 8 },
    { weight_kg: 0, reps: 12 },
    { weight_kg: null, reps: 8 },
  ]);
  const result = await retrieveFitnessRecords(client, owner, JSON.stringify({
    queries: [{ dataset: "exercise", from: "2026-11-22", through: "2026-11-28" }],
  }));
  const url = new URL(String(fetchRecords.mock.calls[0][0]));
  expect(url.pathname).toBe("/rest/v1/workout_sets");
  expect(url.searchParams.get("exercises.name")).toBeNull();
  expect(url.searchParams.getAll("workouts.workout_date")).toEqual(["gte.2026-11-22", "lte.2026-11-28"]);
  expect(result).toMatchObject([{
    matched: 4, complete: true,
    summary: {
      weight_kg: { count: 3, average: 30 },
      loaded_weight_kg: { count: 2, average: 45 },
      volume_kg: { count: 3, sum: 800 },
    },
  }]);
});

it("reports missing weigh-in dates and averages the latest entry per day", async () => {
  const { client, fetchRecords } = database([
    { date: "2026-11-24", weight_kg: 72 },
    { date: "2026-11-24", weight_kg: 74 },
    { date: "2026-11-22", weight_kg: 70 },
  ]);
  const result = await retrieveFitnessRecords(client, owner, JSON.stringify({
    queries: [{ dataset: "weight", from: "2026-11-22", through: "2026-11-24" }],
  }));
  const url = new URL(String(fetchRecords.mock.calls[0][0]));
  expect(url.searchParams.get("order")).toMatch(/^date\.desc\.nullslast,logged_at\.desc\.nullslast/);
  expect(result).toMatchObject([{
    matched: 3,
    coverage: { daysWithRecords: 2, missingDates: ["2026-11-23"] },
    summary: { weight_kg: { count: 2, average: 71 } },
    rows: [{ weight_kg: 72 }, { weight_kg: 70 }],
  }]);
});

it("retrieves only the latest height and scopes the profile lookup to the signed-in account", async () => {
  const { client, fetchRecords } = database([{ height_cm: 171 }], 3);
  const result = await retrieveFitnessRecords(client, owner, JSON.stringify({ queries: [{ dataset: "profile" }] }));
  const url = new URL(String(fetchRecords.mock.calls[0][0]));
  expect(url.pathname).toBe("/rest/v1/body_stats");
  expect(url.searchParams.get("select")).toBe("height_cm");
  expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
  expect(url.searchParams.get("limit")).toBe("1");
  expect(result).toMatchObject([{ complete: true, rows: [{ height_cm: 171 }] }]);
});
