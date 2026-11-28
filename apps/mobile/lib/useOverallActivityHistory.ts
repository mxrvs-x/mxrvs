import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

export const OVERALL_ACTIVITY_PAGE_SIZE = 10;

type OverallActivityRecord = {
  id: string;
  activity_date: string;
  steps: number;
  duration_seconds: number | null;
  calories_burned: number;
};

export function formatOverallActivity(record: OverallActivityRecord) {
  const duration = record.duration_seconds;
  const hours = Math.floor((duration ?? 0) / 3600);
  const minutes = Math.floor(((duration ?? 0) % 3600) / 60);
  const seconds = (duration ?? 0) % 60;
  return {
    date: new Date(`${record.activity_date}T00:00:00Z`).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
    }),
    steps: record.steps.toLocaleString(),
    movingTime: duration === null ? "Unavailable" : hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes}m ${seconds}s`,
    calories: `${Math.round(record.calories_burned).toLocaleString()} kcal`,
  };
}

export function useOverallActivityHistory(client: SupabaseClient, page: number, enabled = true) {
  const [revision, setRevision] = useState(0);
  const request = `${page}:${revision}`;
  const [result, setResult] = useState<{
    request: string;
    rows: OverallActivityRecord[];
    totalPages: number;
    error: string;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const offset = (page - 1) * OVERALL_ACTIVITY_PAGE_SIZE;

    async function load() {
      try {
        const { data, count, error } = await client.from("overall_activity")
          .select("id, activity_date, steps, duration_seconds, calories_burned", { count: "exact" })
          .order("activity_date", { ascending: false })
          .range(offset, offset + OVERALL_ACTIVITY_PAGE_SIZE - 1)
          .abortSignal(controller.signal);
        if (error) throw error;
        if (!controller.signal.aborted) {
          setResult({
            request,
            rows: data ?? [],
            totalPages: Math.ceil((count ?? 0) / OVERALL_ACTIVITY_PAGE_SIZE),
            error: "",
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({ request, rows: [], totalPages: 0, error: "Could not load activity records. Try again." });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [client, enabled, page, request]);

  const current = result?.request === request ? result : null;
  return {
    rows: current?.rows ?? [],
    totalPages: current?.totalPages ?? 0,
    loading: !current,
    error: current?.error ?? "",
    refresh: useCallback(() => setRevision((previous) => previous + 1), []),
  };
}
