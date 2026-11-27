import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { emptyMacros, macroFields, parseMacros, type DailyMacroLog, type MacroDraft } from "./dailyMacros";

export function useDailyMacros(client: SupabaseClient, date: string, onSaved: () => void) {
  const [draft, setDraft] = useState<MacroDraft>(emptyMacros);
  const [userId, setUserId] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const savingRef = useRef(false);
  const canSave = Boolean(userId) && !existing && macroFields.every(({ key }) => draft[key].trim() !== "");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error: authError } = await client.auth.getUser();
        if (authError || !data.user) throw authError ?? new Error("No user");
        const { data: row, error: loadError } = await client
          .from("daily_macro_logs")
          .select("log_date")
          .eq("user_id", data.user.id)
          .eq("log_date", date)
          .maybeSingle();
        if (loadError) throw loadError;
        if (!active) return;
        setExisting(Boolean(row));
        setUserId(data.user.id);
      } catch (error) {
        if (!active) return;
        const code = (error as { code?: string } | null)?.code;
        setError(
          code === "PGRST205" || code === "42P01"
            ? "The macros table is unavailable. Apply the daily macro logs migration in Supabase, then retry."
            : "Could not load this day’s macros. Try again.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [client, date, attempt]);

  async function save() {
    if (!userId || !canSave || savingRef.current) return;
    const parsed = parseMacros(draft);
    if (!parsed.values) {
      setError(parsed.error);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const { error: saveError } = await client.from("daily_macro_logs").insert({
        user_id: userId,
        log_date: date,
        ...parsed.values,
      });
      if (saveError?.code === "23505") {
        setExisting(true);
        setError("Macros are already logged for this date. Open the entry in Macro History to edit it.");
        return;
      }
      if (saveError) throw saveError;
      setExisting(true);
      setDraft(emptyMacros);
      onSaved();
    } catch {
      setError("Could not save your macros. Your values are still here. Try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return {
    draft, loading, saving, error, canSave, existing, ready: Boolean(userId),
    edit(key: keyof MacroDraft, value: string) {
      setDraft((current) => ({ ...current, [key]: value }));
      setError("");
    },
    reload() {
      setUserId(null);
      setLoading(true);
      setError("");
      setAttempt((current) => current + 1);
    },
    save,
  };
}

export function useDailyMacroHistory(client: SupabaseClient, pageSize: number) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    page: number;
    revision: number;
    rows: DailyMacroLog[];
    totalPages: number;
    error: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) throw authError ?? new Error("No user");
        const from = (page - 1) * pageSize;
        const { data, error, count } = await client
          .from("daily_macro_logs")
          .select("log_date, calories, protein_g, carbs_g, fat_g", { count: "exact" })
          .eq("user_id", auth.user.id)
          .order("log_date", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!active) return;

        const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
        if (page > totalPages) {
          setPage(totalPages);
          return;
        }
        setResult({ page, revision, rows: data ?? [], totalPages, error: "" });
      } catch {
        if (active) {
          setResult({ page, revision, rows: [], totalPages: page, error: "Could not load macro history." });
        }
      }
    }

    void load();
    return () => { active = false; };
  }, [client, page, pageSize, revision]);

  const current = result?.page === page && result.revision === revision ? result : null;

  return {
    page,
    setPage,
    rows: current?.rows ?? [],
    totalPages: result?.totalPages ?? 1,
    loading: current === null,
    error: current?.error ?? "",
    refresh() {
      setPage(1);
      setRevision((value) => value + 1);
    },
    refreshPage() {
      setRevision((value) => value + 1);
    },
  };
}

function draftFromLog(row: DailyMacroLog): MacroDraft {
  return {
    calories: String(row.calories),
    protein_g: String(row.protein_g),
    carbs_g: String(row.carbs_g),
    fat_g: String(row.fat_g),
  };
}

export function useMacroLogEditor(
  client: SupabaseClient,
  row: DailyMacroLog,
  onSaved: () => void,
  onDeleted: () => void,
) {
  const [savedRow, setSavedRow] = useState(row);
  const [draft, setDraft] = useState(() => draftFromLog(row));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  function cancel() {
    if (savingRef.current) return;
    setDraft(draftFromLog(savedRow));
    setEditing(false);
    setError("");
  }

  async function save() {
    if (!editing || savingRef.current) return;
    const parsed = parseMacros(draft);
    if (!parsed.values) {
      setError(parsed.error);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("No user");
      const { data, error: updateError } = await client
        .from("daily_macro_logs")
        .update(parsed.values)
        .eq("user_id", auth.user.id)
        .eq("log_date", savedRow.log_date)
        .select("log_date, calories, protein_g, carbs_g, fat_g")
        .single();
      if (updateError || !data) throw updateError ?? new Error("Macro log not found");
      setSavedRow(data);
      setDraft(draftFromLog(data));
      setEditing(false);
      onSaved();
    } catch {
      setError("Could not update this log. Your changes are still here.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirmingDelete || savingRef.current) return;
    savingRef.current = true;
    setDeleting(true);
    setError("");
    try {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("No user");
      const { data, error: deleteError } = await client
        .from("daily_macro_logs")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("log_date", savedRow.log_date)
        .select("log_date")
        .maybeSingle();
      if (deleteError || !data) throw deleteError ?? new Error("Macro log not found");
      onDeleted();
    } catch {
      setError("Could not delete this log. Try again.");
    } finally {
      savingRef.current = false;
      setDeleting(false);
    }
  }

  return {
    row: savedRow, draft, editing, saving, error, cancel, save,
    confirmingDelete, deleting, remove,
    startEditing() {
      setError("");
      setEditing(true);
    },
    setDeleteConfirmation(visible: boolean) {
      if (savingRef.current) return;
      setError("");
      setConfirmingDelete(visible);
    },
    edit(key: keyof MacroDraft, value: string) {
      setDraft((current) => ({ ...current, [key]: value }));
      setError("");
    },
  };
}
