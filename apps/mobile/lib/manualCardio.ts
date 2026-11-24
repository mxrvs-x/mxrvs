export type ManualCardioType = "walking" | "running";

export type ParsedManualCardioEntry = {
  sessionDate: string;
  cardioType: ManualCardioType;
  distanceKm: number;
  durationSeconds: number;
  steps: number;
  caloriesBurned: number;
};

type ManualCardioInput = {
  sessionDate: string;
  cardioType: ManualCardioType;
  distanceKm: string;
  durationMinutes: string;
  steps: string;
  caloriesBurned: string;
  weightKg: number | null;
};

export type ManualCardioParseResult =
  | { entry: ParsedManualCardioEntry; error: null }
  | { entry: null; error: string };

function numberFromInput(value: string) {
  return Number(value.trim().replace(",", "."));
}

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function parseManualCardioEntry(
  input: ManualCardioInput,
): ManualCardioParseResult {
  const sessionDate = input.sessionDate.trim();
  if (!isValidDateKey(sessionDate)) {
    return { entry: null, error: "Enter a valid date in YYYY-MM-DD format." };
  }

  const distanceKm = numberFromInput(input.distanceKm);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return { entry: null, error: "Distance must be greater than zero." };
  }

  const durationMinutes = numberFromInput(input.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { entry: null, error: "Duration must be greater than zero." };
  }

  const steps = input.steps.trim() ? numberFromInput(input.steps) : 0;
  if (!Number.isInteger(steps) || steps < 0) {
    return { entry: null, error: "Steps must be a whole number or left blank." };
  }

  const enteredCalories = input.caloriesBurned.trim()
    ? numberFromInput(input.caloriesBurned)
    : null;
  if (
    enteredCalories !== null &&
    (!Number.isFinite(enteredCalories) || enteredCalories < 0)
  ) {
    return { entry: null, error: "Calories cannot be negative." };
  }

  const weightKg = Number(input.weightKg);
  const estimatedCalories =
    Number.isFinite(weightKg) && weightKg > 0
      ? Math.round(
          weightKg * distanceKm * (input.cardioType === "running" ? 1 : 0.5),
        )
      : 0;

  return {
    entry: {
      sessionDate,
      cardioType: input.cardioType,
      distanceKm: Number(distanceKm.toFixed(3)),
      durationSeconds: Math.max(1, Math.round(durationMinutes * 60)),
      steps,
      caloriesBurned:
        enteredCalories === null
          ? estimatedCalories
          : Math.round(enteredCalories),
    },
    error: null,
  };
}
