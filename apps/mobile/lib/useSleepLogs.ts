import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { SleepLog } from "./sleep";

export function useSleepLogs(client: SupabaseClient, page: number, size: number, day = "") {
  const [revision, setRevision] = useState(0);
  const request = `${page}:${size}:${day}:${revision}`;
  const [result, setResult] = useState<{
    request: string; rows: SleepLog[]; count: number; error: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const from = (page - 1) * size;
        let query = client.from("sleep_logs").select(
          "id, log_date, time_zone, bedtime_at, sleep_onset_at, onset_approximate, final_wake_at, recorded_total_minutes, awakening_tracking, notes, sleep_awakenings(position,woke_at,woke_approximate,resumed_at,resumed_approximate,resume_type,deduct_from_sleep), sleep_naps(started_at,ended_at)",
          { count: "exact" },
        );
        if (day) query = query.eq("log_date", day);
        const { data, error, count } = await query.order("log_date", { ascending: false })
          .order("position", { referencedTable: "sleep_awakenings" })
          .order("started_at", { referencedTable: "sleep_naps" })
          .range(from, from + size - 1).abortSignal(controller.signal);
        if (error) throw error;
        if (!controller.signal.aborted) setResult({ request, rows: (data ?? []) as SleepLog[], count: count ?? 0, error: "" });
      } catch (problem) {
        if (controller.signal.aborted) return;
        const code = (problem as { code?: string } | null)?.code;
        setResult({
          request, rows: [], count: 0,
          error: code === "PGRST205" || code === "42P01"
            ? "Sleep logs are unavailable. Apply the sleep logs migration in Supabase, then retry."
            : "Could not load sleep logs. Try again.",
        });
      }
    }
    void load();
    return () => controller.abort();
  }, [client, day, page, request, size]);

  const current = result?.request === request ? result : null;
  return {
    rows: current?.rows ?? [],
    count: current?.count ?? 0,
    loading: !current,
    error: current?.error ?? "",
    refresh: () => setRevision((value) => value + 1),
  };
}
