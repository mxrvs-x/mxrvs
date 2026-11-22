import {
  getCardioPersonalRecords,
  getStrengthPersonalRecords,
} from "../lib/personalRecords";

describe("personal records", () => {
  it("keeps the reps performed with the heaviest workout set", () => {
    const records = getStrengthPersonalRecords([
      { weight_kg: 80, reps: 5 },
      { weight_kg: 80, reps: 8 },
      { weight_kg: 70, reps: 12 },
    ]);

    expect(records.weight).toEqual({ weight_kg: 80, reps: 8 });
    expect(records).not.toHaveProperty("reps");
  });

  it("uses reps to break ties when every recorded weight is zero", () => {
    const records = getStrengthPersonalRecords([
      { weight_kg: 0, reps: 10 },
      { weight_kg: 0, reps: 18 },
      { weight_kg: 0, reps: 15 },
    ]);

    expect(records.weight).toEqual({ weight_kg: 0, reps: 18 });
  });

  it("calculates cardio records from logged database fields", () => {
    const longest = {
      id: "longest",
      distance_km: 10,
      duration_seconds: 3600,
      steps: 9000,
    };
    const fastest = {
      id: "fastest",
      distance_km: 5,
      duration_seconds: 1200,
      steps: 5000,
    };
    const records = getCardioPersonalRecords([
      longest,
      fastest,
      { id: "steps", distance_km: 8, duration_seconds: 4000, steps: 12000 },
    ]);

    expect(records.distance?.id).toBe("longest");
    expect(records.pace?.id).toBe("fastest");
    expect(records.duration?.id).toBe("steps");
    expect(records.steps?.id).toBe("steps");
  });
});
