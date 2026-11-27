import { sleepLocalTime, type SleepEntry } from "./sleep";

export type SleepRecording = {
  startedAt: string;
  zone: string;
  awakenings: { wokeAt: string; resumedAt: string }[];
  awakeSince: string | null;
  finishedAt: string | null;
};

export function recordedSleepEntry(recording: SleepRecording): SleepEntry | null {
  const wake = recording.finishedAt;
  if (!wake) return null;

  return {
    log_date: sleepLocalTime(wake, recording.zone).slice(0, 10),
    time_zone: recording.zone,
    bedtime_at: recording.startedAt,
    sleep_onset_at: recording.startedAt,
    onset_approximate: true,
    final_wake_at: wake,
    recorded_total_minutes: null,
    awakening_tracking: "partial",
    notes: null,
    sleep_awakenings: recording.awakenings.map(({ wokeAt, resumedAt }, position) => ({
      position, woke_at: wokeAt, woke_approximate: false, resumed_at: resumedAt,
      resumed_approximate: true, resume_type: "timed", deduct_from_sleep: true,
    })),
    sleep_naps: [],
  };
}

export function recordedSleepSeconds(recording: SleepRecording, now: number) {
  const end = recording.finishedAt ?? recording.awakeSince;
  const elapsed = (end ? Date.parse(end) : now) - Date.parse(recording.startedAt);
  const awake = recording.awakenings.reduce(
    (sum, { wokeAt, resumedAt }) => sum + Date.parse(resumedAt) - Date.parse(wokeAt), 0,
  );
  return Math.max(0, Math.floor((elapsed - awake) / 1000));
}
