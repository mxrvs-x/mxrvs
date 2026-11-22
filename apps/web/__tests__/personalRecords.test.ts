import {
  getCardioPersonalRecords,
  getStrengthPersonalRecords,
} from "../lib/personalRecords";

describe("personal records", () => {
  it("returns only the heaviest set as the workout PR", () => {
    const records = getStrengthPersonalRecords([
      { exercise_name: "Bench Press", weight_kg: 100, reps: 3 },
      { exercise_name: "Bench Press", weight_kg: 100, reps: 5 },
      { exercise_name: "Squat", weight_kg: 80, reps: 12 },
    ]);

    expect(records.weight).toMatchObject({ weight_kg: 100, reps: 5 });
    expect(records).not.toHaveProperty("reps");
  });

  it("returns the highest reps when all exercise weights are zero", () => {
    const records = getStrengthPersonalRecords([
      { weight_kg: 0, reps: 12 },
      { weight_kg: 0, reps: 20 },
    ]);

    expect(records.weight).toEqual({ weight_kg: 0, reps: 20 });
  });

  it("returns distance, pace, duration, and step cardio records", () => {
    const records = getCardioPersonalRecords([
      { id: "distance", distance_km: 12, duration_seconds: 4200, steps: 10000 },
      { id: "pace", distance_km: 5, duration_seconds: 1200, steps: 5000 },
      { id: "steps", distance_km: 8, duration_seconds: 5000, steps: 14000 },
    ]);

    expect(records.distance?.id).toBe("distance");
    expect(records.pace?.id).toBe("pace");
    expect(records.duration?.id).toBe("steps");
    expect(records.steps?.id).toBe("steps");
  });
});
