import { parseSleepTime, sleepLocalTime, summarizeSleep, validateSleep, type SleepEntry } from "../lib/sleep";
import { recordedSleepEntry, recordedSleepSeconds, type SleepRecording } from "../lib/sleepRecording";

const zone = "Asia/Manila";
const time = (value: string) => parseSleepTime(value, zone);
const entry: SleepEntry = {
  log_date: "2026-11-26", time_zone: zone, bedtime_at: time("2026-11-26 00:07"),
  sleep_onset_at: time("2026-11-26 00:22"), final_wake_at: time("2026-11-26 09:00"),
  onset_approximate: false, recorded_total_minutes: null, awakening_tracking: "complete",
  notes: null, sleep_naps: [], sleep_awakenings: [{
    position: 0, woke_at: time("2026-11-26 04:00"), resumed_at: time("2026-11-26 05:24"),
    woke_approximate: true, resumed_approximate: true, resume_type: "timed", deduct_from_sleep: true,
  }],
};

it("calculates the Nov 26 recovered night and keeps its approximate label", () => {
  expect(validateSleep(entry)).toBeNull();
  expect(summarizeSleep(entry)).toMatchObject({ total: 434, awake: 84, awakenings: "1", totalLabel: "Estimated total" });
});

it("handles midnight, a brief counted awakening, and a separate nap", () => {
  const sleep: SleepEntry = {
    ...entry, log_date: "2026-10-24", bedtime_at: null,
    sleep_onset_at: time("2026-10-23 23:45"), final_wake_at: time("2026-10-24 05:16"),
    sleep_awakenings: [{
      ...entry.sleep_awakenings[0], woke_at: null, resumed_at: null,
      resume_type: "immediate", deduct_from_sleep: false,
    }],
    sleep_naps: [{ started_at: time("2026-10-24 09:40"), ended_at: time("2026-10-24 11:12") }],
  };
  expect(validateSleep(sleep)).toBeNull();
  expect(summarizeSleep(sleep)).toMatchObject({ total: 423, overnight: 331, naps: 92, awake: 0, awakenings: "1" });
  expect(sleepLocalTime(sleep.final_wake_at, zone)).toBe("2026-10-24 05:16");
});

it("keeps recorded totals when a deductible awakening has unknown duration", () => {
  const unknown: SleepEntry = {
    ...entry, awakening_tracking: "partial",
    sleep_awakenings: [{ ...entry.sleep_awakenings[0], resumed_at: null, resume_type: "unknown" }],
  };
  expect(validateSleep(unknown)).toContain("recorded total");
  const recorded = { ...unknown, recorded_total_minutes: 434 };
  expect(validateSleep(recorded)).toBeNull();
  expect(summarizeSleep(recorded)).toMatchObject({ total: 434, awake: null, overnight: null, awakenings: "1 reported", totalLabel: "Recorded total" });
});

it("rejects overlapping or out-of-window intervals", () => {
  const overlap = { ...entry.sleep_awakenings[0], position: 1, woke_at: time("2026-11-26 04:30") };
  expect(validateSleep({ ...entry, sleep_awakenings: [...entry.sleep_awakenings, overlap] })).toContain("overlap");
  expect(validateSleep({ ...entry, sleep_awakenings: [{ ...overlap, resumed_at: entry.final_wake_at }] })).toContain("within");
  expect(validateSleep({ ...entry, sleep_naps: [{ started_at: time("2026-11-26 06:00"), ended_at: time("2026-11-26 08:00") }] })).toContain("overlap");
});

it("rejects invalid calendar dates and nonexistent daylight-saving times", () => {
  expect(() => time("2026-02-30 01:00")).toThrow();
  expect(() => parseSleepTime("2026-03-08 02:30", "America/New_York")).toThrow();
});

it("keeps elapsed sleep across midnight and subtracts both completed and ongoing awakenings", () => {
  const recording: SleepRecording = {
    zone,
    startedAt: time("2026-11-26 23:00"),
    awakenings: [{ wokeAt: time("2026-11-27 02:00"), resumedAt: time("2026-11-27 02:30") }],
    awakeSince: null,
    finishedAt: null,
  };
  const seven = time("2026-11-27 07:00");
  const now = Date.parse(time("2026-11-27 07:30"));
  expect(recordedSleepSeconds({ ...recording, awakeSince: seven }, now)).toBe(7.5 * 3600);
  expect(recordedSleepSeconds(recording, now)).toBe(8 * 3600);
  expect(recordedSleepEntry(recording)).toBeNull();
  const finished = { ...recording, awakeSince: seven, finishedAt: seven };
  expect(recordedSleepSeconds(finished, now)).toBe(7.5 * 3600);
  const log = recordedSleepEntry(finished)!;
  expect(validateSleep(log)).toBeNull();
  expect(log).toMatchObject({ log_date: "2026-11-27", final_wake_at: seven, onset_approximate: true });
  expect(summarizeSleep(log)).toMatchObject({ total: 450, awake: 30, awakenings: "1 reported" });
});
