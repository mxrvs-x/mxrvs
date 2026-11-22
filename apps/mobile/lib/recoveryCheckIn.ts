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
  {
    key: "recovery_soreness",
    label: "Soreness",
    hint: "1 none · 5 severe",
  },
  {
    key: "recovery_motivation",
    label: "Motivation",
    hint: "1 low · 5 high",
  },
  {
    key: "recovery_stress",
    label: "Stress",
    hint: "1 low · 5 high",
  },
];

export function createRecoveryCheckIn(defaultScore: number | null = null) {
  return RECOVERY_METRICS.reduce<RecoveryCheckIn>(
    (checkIn, metric) => ({ ...checkIn, [metric.key]: defaultScore }),
    {
      recovery_energy: defaultScore,
      recovery_sleep_quality: defaultScore,
      recovery_soreness: defaultScore,
      recovery_motivation: defaultScore,
      recovery_stress: defaultScore,
    },
  );
}

export function recoveryCheckInLines(
  checkIn: Partial<RecoveryCheckIn>,
) {
  return RECOVERY_METRICS.flatMap((metric) => {
    const score = checkIn[metric.key];
    return typeof score === "number" ? [`${metric.label}: ${score}/5`] : [];
  });
}
