import PaginationControls from "@/components/PaginationControls";
import ThemedAlert from "@/components/ThemedAlert";
import { toLocalDateKey } from "@/lib/dates";
import {
  formatMinutes, parseSleepTime, sleepLocalTime, summarizeSleep, validateSleep,
  type ResumeType, type SleepEntry, type SleepLog, type Tracking,
} from "@/lib/sleep";
import { recordedSleepEntry, recordedSleepSeconds, type SleepRecording } from "@/lib/sleepRecording";
import { loadSleepRecording, storeSleepRecording } from "@/lib/sleepRecordingStorage";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useSleepLogs } from "@/lib/useSleepLogs";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AwakeningDraft = {
  id: number; woke: string; wokeApproximate: boolean; resume: ResumeType; resumed: string;
  resumedApproximate: boolean; deduct: boolean;
};
type NapDraft = { id: number; start: string; end: string };
type SleepDraft = {
  day: string; zone: string; bedtime: string; onset: string; approximate: boolean;
  wake: string; recorded: string; tracking: Tracking; notes: string;
  awakenings: AwakeningDraft[]; naps: NapDraft[];
};

function makeDraft(log: SleepEntry | null): SleepDraft {
  const zone = log?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const local = (time: string | null | undefined) => sleepLocalTime(time ?? null, zone);
  return {
    day: log?.log_date ?? toLocalDateKey(),
    zone, bedtime: local(log?.bedtime_at), onset: local(log?.sleep_onset_at),
    approximate: log?.onset_approximate ?? false, wake: local(log?.final_wake_at),
    recorded: log?.recorded_total_minutes?.toString() ?? "", tracking: log?.awakening_tracking ?? "complete",
    notes: log?.notes ?? "",
    awakenings: log?.sleep_awakenings.map((a, id) => ({
      id, woke: local(a.woke_at), wokeApproximate: a.woke_approximate, resumed: local(a.resumed_at),
      resumedApproximate: a.resumed_approximate, resume: a.resume_type, deduct: a.deduct_from_sleep,
    })) ?? [],
    naps: log?.sleep_naps.map((nap, id) => ({ id, start: local(nap.started_at), end: local(nap.ended_at) })) ?? [],
  };
}

function prepareEntry(draft: SleepDraft, originalEntry?: SleepEntry): SleepEntry {
  // The editor shows minutes. Preserve the recorder's seconds when the displayed time is unchanged.
  const time = (value: string, original?: string | null) =>
    original && value.trim() === sleepLocalTime(original, draft.zone) ? original
      : value.trim() ? parseSleepTime(value, draft.zone) : null;
  return {
    id: originalEntry?.id, log_date: draft.day.trim(), time_zone: draft.zone,
    bedtime_at: time(draft.bedtime, originalEntry?.bedtime_at),
    sleep_onset_at: time(draft.onset, originalEntry?.sleep_onset_at), onset_approximate: draft.approximate,
    final_wake_at: time(draft.wake, originalEntry?.final_wake_at),
    recorded_total_minutes: draft.recorded.trim() ? Number(draft.recorded) : null,
    awakening_tracking: draft.tracking, notes: draft.notes.trim() || null,
    sleep_awakenings: draft.awakenings.map((a, position) => ({
      position, woke_at: time(a.woke, originalEntry?.sleep_awakenings[a.id]?.woke_at),
      woke_approximate: a.wokeApproximate, resume_type: a.resume,
      resumed_at: a.resume === "timed" ? time(a.resumed, originalEntry?.sleep_awakenings[a.id]?.resumed_at) : null,
      resumed_approximate: a.resume === "timed" && a.resumedApproximate,
      deduct_from_sleep: a.resume !== "immediate" && a.deduct,
    })),
    sleep_naps: draft.naps.map((nap) => {
      const started_at = time(nap.start, originalEntry?.sleep_naps[nap.id]?.started_at);
      const ended_at = time(nap.end, originalEntry?.sleep_naps[nap.id]?.ended_at);
      if (!started_at || !ended_at) throw new Error("Enter both times for each nap.");
      return { started_at, ended_at };
    }),
  };
}

export default function SleepScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { review } = useLocalSearchParams<{ review?: string }>();
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState(false);
  const [editor, setEditor] = useState<{ log: SleepLog | null } | null>(null);
  const [notice, setNotice] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const size = history ? 10 : 5;
  const logs = useSleepLogs(supabase, page, size);
  const clearReviewRequest = useCallback(() => router.setParams({ review: undefined }), [router]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  function finish(message: string) {
    setPage(1);
    setEditor(null);
    logs.refresh();
    setNotice(message);
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Sleep</Text>
        {userId && <SleepRecorder key={userId} userId={userId} onSaved={() => finish("Sleep logged")}
          reviewRequested={review === "widget"} onReviewHandled={clearReviewRequest} />}
        <Action label="Log sleep manually" onPress={() => setEditor({ log: null })} />
        <View style={styles.row}>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
            {history ? "Sleep History" : "Recent Logs"}
          </Text>
          <Action label={history ? "Recent" : "View history"} onPress={() => { setHistory(!history); setPage(1); }} />
        </View>
        {logs.loading && <Text style={{ color: colors.textMuted }}>Loading sleep logs…</Text>}
        {logs.error ? (
          <>
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>{logs.error}</Text>
            <Action label="Retry" onPress={() => { setPage(1); logs.refresh(); }} />
          </>
        ) : null}
        {!logs.loading && !logs.error && !logs.rows.length && <Text style={{ color: colors.textMuted }}>No sleep logs yet.</Text>}
        {logs.rows.map((log) => (
          <Pressable key={log.id} accessibilityRole="button" onPress={() => setEditor({ log })}
            style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.heading, { color: colors.text }]}>
              {new Date(`${log.log_date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </Text>
            <SleepSummary entry={log} />
          </Pressable>
        ))}
        {history && <PaginationControls page={page} totalPages={Math.ceil(logs.count / size)} onPageChange={setPage} />}
      </ScrollView>
      {editor && <SleepEditor log={editor.log} onClose={() => setEditor(null)} onDone={finish} />}
      <ThemedAlert visible={Boolean(notice)} title={notice} message="Sleep history was updated." onClose={() => setNotice("")} />
    </SafeAreaView>
  );
}

function SleepRecorder({ userId, onSaved, reviewRequested, onReviewHandled }: {
  userId: string; onSaved: () => void; reviewRequested: boolean; onReviewHandled: () => void;
}) {
  const { colors } = useTheme();
  const [recording, setRecording] = useState<SleepRecording | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const [review, setReview] = useState(false);
  const [discard, setDiscard] = useState(false);
  const pending = useRef(false);
  const rawRecording = useRef<string | null>(null);
  const storageRevision = useRef(0);
  const running = Boolean(recording && !recording.finishedAt && !recording.awakeSince);

  useFocusEffect(useCallback(() => {
    let active = true;
    async function refresh() {
      if (pending.current) return;
      const request = ++storageRevision.current;
      try {
        const value = await loadSleepRecording(userId);
        if (!active || request !== storageRevision.current) return;
        const latest = value ? JSON.parse(value) as SleepRecording : null;
        setRecording(latest);
        rawRecording.current = value;
        setNow(Date.now());
        setLoadFailed(false);
        setLoading(false);
        if (reviewRequested) {
          if (latest?.finishedAt) setReview(true);
          onReviewHandled();
        }
      } catch {
        if (active && request === storageRevision.current) {
          setLoadFailed(true);
          setLoading(false);
        }
      }
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    void refresh();
    return () => {
      active = false;
      subscription.remove();
    };
  }, [userId, revision, reviewRequested, onReviewHandled]));

  useFocusEffect(useCallback(() => {
    if (!running) return;

    // Only the display needs ticks. Elapsed sleep comes from saved timestamps.
    let interval: ReturnType<typeof setInterval> | undefined;
    function stopClock() {
      clearInterval(interval);
      interval = undefined;
    }
    const update = () => setNow(Date.now());
    function syncClock(active: boolean) {
      stopClock();
      if (!active) return;
      update();
      interval = setInterval(update, 1000);
    }

    const subscription = AppState.addEventListener("change", (state) => syncClock(state === "active"));
    syncClock(AppState.currentState === "active");
    return () => {
      subscription.remove();
      stopClock();
    };
  }, [running]));

  async function persist(next: SleepRecording | null) {
    if (pending.current) return false;
    pending.current = true;
    storageRevision.current++;
    setBusy(true);
    setError("");
    try {
      const value = next ? JSON.stringify(next) : null;
      if (!await storeSleepRecording(userId, rawRecording.current, value)) {
        setError("The recording changed on the home screen. Check its latest state and try again.");
        setRevision((current) => current + 1);
        return false;
      }
      rawRecording.current = value;
      setRecording(next);
      setNow(Date.now());
      return true;
    } catch {
      setError("Could not update the recording on this device. Try again.");
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function record(action: "start" | "wake" | "resume" | "finish") {
    const at = new Date().toISOString();
    if (action === "start") {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      void persist({ startedAt: at, zone, awakenings: [], awakeSince: null, finishedAt: null });
      return;
    }
    if (!recording || recording.finishedAt) return;
    const lastEvent = recording.awakeSince ?? recording.awakenings.at(-1)?.resumedAt ?? recording.startedAt;
    if (at <= lastEvent) {
      setError("Wait a moment before recording the next event.");
      return;
    }
    if (action === "wake") void persist({ ...recording, awakeSince: at });
    if (action === "resume" && recording.awakeSince) {
      void persist({
        ...recording,
        awakeSince: null,
        awakenings: [...recording.awakenings, { wokeAt: recording.awakeSince, resumedAt: at }],
      });
    }
    if (action === "finish") {
      void persist({ ...recording, finishedAt: recording.awakeSince ?? at }).then((saved) => {
        if (saved) {
          setDiscard(false);
          setReview(true);
        }
      });
    }
  }

  const seconds = recording ? recordedSleepSeconds(recording, now) : 0;
  const timer = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
  const reviewEntry = review && recording ? recordedSleepEntry(recording) : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Sleep timer</Text>
      {loading ? <Text style={{ color: colors.textMuted }}>Loading recording…</Text>
        : loadFailed ? <>
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>Could not load the saved recording.</Text>
          <Action label="Retry" onPress={() => {
            setLoadFailed(false);
            setLoading(true);
            setRevision((current) => current + 1);
          }} />
        </> : !recording ? <>
          <Text style={{ color: colors.textMuted }}>Start when you’re ready to fall asleep.</Text>
          <Action label="Start sleep" primary disabled={busy} onPress={() => record("start")} />
        </> : <>
          <Text style={{ fontSize: 32, fontWeight: "900", fontVariant: ["tabular-nums"], color: colors.text }}>{timer}</Text>
          <Text style={{ color: colors.textMuted }}>
            {recording.finishedAt ? "Ready to review" : recording.awakeSince ? "Awake · timer paused" : "Recording estimated sleep"}
            {" · "}{recording.awakenings.length} completed {recording.awakenings.length === 1 ? "awakening" : "awakenings"}
          </Text>
          {discard ? <>
            <Text style={{ color: colors.text }}>Discard this unsaved recording?</Text>
            <View style={styles.choices}>
              <Action label="Discard recording" danger disabled={busy} onPress={() => {
                void persist(null).then((saved) => { if (saved) setDiscard(false); });
              }} />
              <Action label="Keep recording" disabled={busy} onPress={() => setDiscard(false)} />
            </View>
          </> : <View style={styles.choices}>
            {recording.finishedAt
              ? <Action label="Review sleep" primary disabled={busy} onPress={() => setReview(true)} />
              : <>
                <Action label={recording.awakeSince ? "Back to sleep" : "Woke up"} primary disabled={busy}
                  onPress={() => record(recording.awakeSince ? "resume" : "wake")} />
                <Action label="Finish sleep" disabled={busy} onPress={() => record("finish")} />
              </>}
            <Action label="Discard" disabled={busy} onPress={() => setDiscard(true)} />
          </View>}
        </>}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      {reviewEntry && <SleepEditor log={null} recording={reviewEntry} onClose={() => setReview(false)} onDone={() => {
        setReview(false);
        onSaved();
        void persist(null);
      }} />}
    </View>
  );
}

function SleepEditor({ log, recording, onClose, onDone }: {
  log: SleepLog | null; recording?: SleepEntry; onClose: () => void; onDone: (message: string) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(() => makeDraft(log ?? recording ?? null));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const operation = useRef(false);
  const nextId = useRef(Math.max(draft.awakenings.length, draft.naps.length));
  function change(fields: Partial<SleepDraft>) {
    setDraft((current) => ({ ...current, ...fields }));
    setError("");
  }
  function changeAwakening(id: number, fields: Partial<AwakeningDraft>) {
    change({ awakenings: draft.awakenings.map((item) => item.id === id ? { ...item, ...fields } : item) });
  }
  function changeNap(id: number, fields: Partial<NapDraft>) {
    change({ naps: draft.naps.map((item) => item.id === id ? { ...item, ...fields } : item) });
  }
  let entry: SleepEntry | null = null;
  let validation = "";
  try {
    entry = prepareEntry(draft, log ?? recording);
    validation = validateSleep(entry) ?? "";
  } catch (problem) {
    validation = problem instanceof Error ? problem.message : "Check the sleep times.";
  }

  async function submit(remove = false) {
    if (operation.current) return;
    if (!remove && (!entry || validation)) { setError(validation); return; }
    if (remove && !log) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      if (remove && log) {
        const { data, error: problem } = await supabase.from("sleep_logs").delete().eq("id", log.id).select("id").single();
        if (problem || !data) throw problem ?? new Error("Sleep log not found.");
      } else {
        const { error: problem } = await supabase.rpc("save_sleep_log", { entry });
        if (problem) throw problem;
      }
      onDone(remove ? "Sleep log deleted" : "Sleep logged");
    } catch (problem) {
      const code = (problem as { code?: string } | null)?.code;
      setError(code === "23505" ? "A sleep log already exists for this date. Open it from Sleep History to edit it."
        : remove ? "Could not delete the sleep log." : "Could not save the sleep log. Your entries are still here.");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screen}>
            <View style={styles.row}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
                {recording ? "Review sleep" : log ? "Edit sleep" : "Log sleep"}
              </Text>
              <Action label="Close" onPress={onClose} disabled={busy} />
            </View>
            <Text style={{ color: colors.textMuted }}>Times in {draft.zone}. Use YYYY-MM-DD HH:MM in 24-hour time. Include the next date for times after midnight.</Text>
            <Field label="Log date" value={draft.day} onChange={(day) => change({ day })} disabled={busy} placeholder="YYYY-MM-DD" />
            <Field label="Bedtime (optional)" value={draft.bedtime} onChange={(bedtime) => change({ bedtime })} disabled={busy} />
            <Field label="Fell asleep" value={draft.onset} onChange={(onset) => change({ onset })} disabled={busy} />
            <Toggle label="Sleep onset is approximate" value={draft.approximate} onChange={(approximate) => change({ approximate })} disabled={busy} />
            <Field label="Final wake-up" value={draft.wake} onChange={(wake) => change({ wake })} disabled={busy} />

            <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Awakenings</Text>
            <Choices value={draft.tracking} choices={[["complete", "Complete"], ["partial", "Partial"], ["unknown", "Unknown"]]}
              onChange={(tracking) => change({ tracking })} disabled={busy} />
            {draft.awakenings.map((item, index) => (
              <View key={item.id} style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.row}>
                  <Text style={[styles.heading, { color: colors.text }]}>Awakening {index + 1}</Text>
                  <Action label="Remove" disabled={busy} onPress={() => change({ awakenings: draft.awakenings.filter((a) => a.id !== item.id) })} />
                </View>
                <Field label="Woke up at (blank if unknown)" value={item.woke} disabled={busy} onChange={(woke) => changeAwakening(item.id, { woke })} />
                <Toggle label="Wake time is approximate" value={item.wokeApproximate} disabled={busy} onChange={(wokeApproximate) => changeAwakening(item.id, { wokeApproximate })} />
                <Text style={{ color: colors.text, fontWeight: "700" }}>Fell back asleep</Text>
                <Choices value={item.resume} choices={[["timed", "Enter time"], ["immediate", "Immediately"], ["unknown", "Unknown"]]}
                  onChange={(resume) => changeAwakening(item.id, { resume, deduct: resume === "timed" })} disabled={busy} />
                {item.resume === "timed" && <>
                  <Field label="Fell back asleep at" value={item.resumed} disabled={busy} onChange={(resumed) => changeAwakening(item.id, { resumed })} />
                  <Toggle label="Return time is approximate" value={item.resumedApproximate} disabled={busy} onChange={(resumedApproximate) => changeAwakening(item.id, { resumedApproximate })} />
                </>}
                {item.resume !== "immediate" && <Toggle label="Deduct time from sleep" value={item.deduct} disabled={busy} onChange={(deduct) => changeAwakening(item.id, { deduct })} />}
              </View>
            ))}
            <Action label="Add awakening" disabled={busy} onPress={() => change({
              awakenings: [...draft.awakenings, { id: nextId.current++, woke: "", wokeApproximate: false, resumed: "", resumedApproximate: false, resume: "timed", deduct: true }],
            })} />

            <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Naps</Text>
            {draft.naps.map((nap, index) => (
              <View key={nap.id} style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.row}>
                  <Text style={[styles.heading, { color: colors.text }]}>Nap {index + 1}</Text>
                  <Action label="Remove" disabled={busy} onPress={() => change({ naps: draft.naps.filter((n) => n.id !== nap.id) })} />
                </View>
                <Field label="Nap started" value={nap.start} disabled={busy} onChange={(start) => changeNap(nap.id, { start })} />
                <Field label="Nap ended" value={nap.end} disabled={busy} onChange={(end) => changeNap(nap.id, { end })} />
              </View>
            ))}
            <Action label="Add nap" disabled={busy} onPress={() => change({ naps: [...draft.naps, { id: nextId.current++, start: "", end: "" }] })} />
            <Field label="Recorded total in minutes (optional, including naps)" value={draft.recorded}
              onChange={(recorded) => change({ recorded })} disabled={busy} placeholder="Use calculated total" numeric />
            <Field label="Notes (optional)" value={draft.notes} disabled={busy} onChange={(notes) => change({ notes })} placeholder="" multiline />
            {entry && !validation && <View style={[styles.card, { backgroundColor: colors.surface }]}><SleepSummary entry={entry} /></View>}
            {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
            {confirmDelete ? (
              <>
                <Text style={{ color: colors.text }}>Delete this log, its awakenings, and its naps?</Text>
                <View style={styles.row}>
                  <Action label={busy ? "Deleting…" : "Delete log"} disabled={busy} danger onPress={() => void submit(true)} />
                  <Action label="Cancel" disabled={busy} onPress={() => setConfirmDelete(false)} />
                </View>
              </>
            ) : (
              <>
                <Action label={busy ? "Saving…" : "Save sleep"} disabled={busy} primary onPress={() => void submit()} />
                {log && <Action label="Delete log" disabled={busy} danger onPress={() => { setError(""); setConfirmDelete(true); }} />}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function SleepSummary({ entry }: { entry: SleepEntry }) {
  const { colors } = useTheme();
  const summary = summarizeSleep(entry);
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.text, fontWeight: "800" }}>{summary.totalLabel} · {formatMinutes(summary.total)}</Text>
      <Text style={{ color: colors.textMuted }}>Awakenings · {summary.awakenings}</Text>
      <Text style={{ color: colors.textMuted }}>Overnight · {formatMinutes(summary.overnight)} · Naps · {formatMinutes(summary.naps)}</Text>
      <Text style={{ color: colors.textMuted }}>Deducted awake time · {formatMinutes(summary.awake)}</Text>
    </View>
  );
}

function Field({ label, value, onChange, disabled, placeholder = "YYYY-MM-DD HH:MM", numeric, multiline }: {
  label: string; value: string; onChange: (value: string) => void; disabled: boolean;
  placeholder?: string; numeric?: boolean; multiline?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
        autoCorrect={false} autoCapitalize={multiline ? "sentences" : "none"} multiline={multiline}
        keyboardType={numeric ? "number-pad" : "default"} placeholder={placeholder} placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} />
    </View>
  );
}

function Toggle({ label, value, onChange, disabled }: {
  label: string; value: boolean; onChange: (value: boolean) => void; disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ flex: 1, color: colors.text }}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary }} />
    </View>
  );
}

function Choices<T extends string>({ choices, value, onChange, disabled }: {
  choices: readonly (readonly [T, string])[]; value: T; onChange: (value: T) => void; disabled: boolean;
}) {
  return (
    <View style={styles.choices}>
      {choices.map(([key, label]) => <Action key={key} label={label} selected={key === value}
        primary={key === value} disabled={disabled} onPress={() => onChange(key)} />)}
    </View>
  );
}

function Action({ label, onPress, primary, danger, disabled, selected }: {
  label: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; selected?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
      style={[styles.button, { backgroundColor: danger ? colors.danger : primary ? colors.primary : colors.surfaceAlt, opacity: disabled ? 0.6 : 1 }]}>
      <Text style={{ color: primary || danger ? colors.textInverse : colors.text, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 20, gap: 14 },
  title: { fontSize: 28, fontWeight: "900" },
  heading: { fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  choices: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  card: { padding: 16, borderRadius: 16, gap: 10 },
  input: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, fontSize: 16 },
  button: { minHeight: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: 14, borderRadius: 12 },
});
