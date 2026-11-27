export type Tracking = "complete" | "partial" | "unknown";
export type ResumeType = "timed" | "immediate" | "unknown";

export type Awakening = {
  position: number;
  woke_at: string | null;
  woke_approximate: boolean;
  resumed_at: string | null;
  resumed_approximate: boolean;
  resume_type: ResumeType;
  deduct_from_sleep: boolean;
};

export type Nap = { started_at: string; ended_at: string };

export type SleepEntry = {
  id?: string;
  log_date: string;
  time_zone: string;
  bedtime_at: string | null;
  sleep_onset_at: string | null;
  onset_approximate: boolean;
  final_wake_at: string | null;
  recorded_total_minutes: number | null;
  awakening_tracking: Tracking;
  notes: string | null;
  sleep_awakenings: Awakening[];
  sleep_naps: Nap[];
};

export type SleepLog = SleepEntry & { id: string };

export function formatMinutes(minutes: number | null) {
  return minutes === null ? "Unknown" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function summarizeSleep(entry: SleepEntry) {
  const deducted = entry.sleep_awakenings.filter((item) => item.deduct_from_sleep);
  const unknownAwake = deducted.some((item) => !item.woke_at || !item.resumed_at);
  const awakeMs = deducted.reduce((total, item) => total + (
    item.woke_at && item.resumed_at ? Date.parse(item.resumed_at) - Date.parse(item.woke_at) : 0
  ), 0);
  const napMs = entry.sleep_naps.reduce((total, nap) => total + Date.parse(nap.ended_at) - Date.parse(nap.started_at), 0);
  const overnightMs = entry.sleep_onset_at && entry.final_wake_at && !unknownAwake
    ? Date.parse(entry.final_wake_at) - Date.parse(entry.sleep_onset_at) - awakeMs
    : null;
  const minutes = (ms: number) => Math.round(ms / 60_000);
  const calculatedTotal = overnightMs === null ? null : minutes(overnightMs + napMs);
  const approximate = entry.onset_approximate || entry.awakening_tracking !== "complete"
    || deducted.some((item) => item.woke_approximate || item.resumed_approximate);
  const count = entry.sleep_awakenings.length;
  return {
    total: entry.recorded_total_minutes ?? calculatedTotal,
    totalLabel: entry.recorded_total_minutes !== null ? "Recorded total" : approximate ? "Estimated total" : "Total sleep",
    overnight: overnightMs === null ? null : minutes(overnightMs),
    awake: unknownAwake ? null : minutes(awakeMs),
    naps: minutes(napMs),
    awakenings: count > 0 && entry.awakening_tracking !== "complete"
      ? `${count} reported`
      : entry.awakening_tracking === "unknown" ? "Unknown"
      : entry.awakening_tracking === "partial" ? "None reported" : String(count),
  };
}

export function validateSleep(entry: SleepEntry) {
  const { bedtime_at: bedtime, sleep_onset_at: onset, final_wake_at: wake, recorded_total_minutes: recorded } = entry;
  const before = (a: string | null, b: string | null) => a !== null && b !== null && Date.parse(a) < Date.parse(b);
  if (!isSleepDate(entry.log_date)) return "Enter a valid log date (YYYY-MM-DD).";
  if (recorded !== null && (!Number.isInteger(recorded) || recorded < 0 || recorded > 1440)) {
    return "Enter a recorded total between 0 and 1440 minutes.";
  }
  if (recorded === null && (!onset || !wake)) return "Enter sleep onset and final wake-up, or supply a recorded total.";
  if (onset && wake && !before(onset, wake)) return "Final wake-up must be after sleep onset.";
  if (before(onset, bedtime) || (bedtime && wake && !before(bedtime, wake))) {
    return "Bedtime must be at or before sleep onset and before final wake-up.";
  }
  for (const a of entry.sleep_awakenings) {
    if (a.resume_type === "timed" && !a.resumed_at) return "Enter when you fell back asleep or select another option.";
    if (a.woke_at && a.resumed_at && !before(a.woke_at, a.resumed_at)) return "Returning to sleep must be after waking up.";
    const outside = (time: string | null) => time && (
      (onset && before(time, onset)) || (wake && !before(time, wake))
    );
    if (outside(a.woke_at) || outside(a.resumed_at) || (onset && a.resumed_at && !before(onset, a.resumed_at))) {
      return "Awakenings must be within the overnight sleep window.";
    }
    if (recorded === null && a.deduct_from_sleep && (!a.woke_at || !a.resumed_at)) {
      return "Enter both awakening times to deduct them, or provide a recorded total.";
    }
  }
  const awakenings = entry.sleep_awakenings;
  for (const [i, a] of awakenings.entries()) {
    for (const b of awakenings.slice(i + 1)) {
      if ((before(a.woke_at, b.resumed_at) && before(b.woke_at, a.resumed_at))
        || (before(a.woke_at, b.woke_at) && before(b.woke_at, a.resumed_at))
        || (before(b.woke_at, a.woke_at) && before(a.woke_at, b.resumed_at))) {
        return "Awakening periods cannot overlap.";
      }
    }
  }
  for (const [i, nap] of entry.sleep_naps.entries()) {
    if (!before(nap.started_at, nap.ended_at)) return "Each nap must end after it starts.";
    if (before(nap.started_at, wake) && before(onset, nap.ended_at)) return "A nap cannot overlap overnight sleep.";
    if (entry.sleep_naps.slice(i + 1).some((other) => before(nap.started_at, other.ended_at) && before(other.started_at, nap.ended_at))) {
      return "Naps cannot overlap.";
    }
  }
  return null;
}

export function isSleepDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function sleepLocalTime(iso: string | null, timeZone: string) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (key: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function parseSleepTime(input: string, timeZone: string) {
  const value = input.trim();
  const [day, clock] = value.split(" ");
  if (!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d$/.test(value) || !isSleepDate(day)) {
    throw new Error("Use YYYY-MM-DD HH:MM (24-hour time) for sleep times.");
  }
  const target = Date.parse(`${day}T${clock}:00Z`);
  let instant = target;
  // Compare the wall clock in the recorded time zone to the requested time.
  // Round-trip validation rejects local times skipped when clocks move forward.
  for (let i = 0; i < 3; i++) {
    const rendered = sleepLocalTime(new Date(instant).toISOString(), timeZone);
    if (rendered === value) return new Date(instant).toISOString();
    instant += target - Date.parse(rendered.replace(" ", "T") + ":00Z");
  }
  throw new Error("That time does not exist in the selected time zone.");
}
