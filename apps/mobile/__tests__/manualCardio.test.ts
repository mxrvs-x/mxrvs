import { parseManualCardioEntry } from "../lib/manualCardio";

const validInput = {
  sessionDate: "2026-11-24",
  cardioType: "walking" as const,
  distanceKm: "3.25",
  durationMinutes: "40",
  steps: "4200",
  caloriesBurned: "",
  weightKg: 70,
};

describe("manual cardio entry", () => {
  it("normalizes a manual walking session and estimates calories", () => {
    expect(parseManualCardioEntry(validInput)).toEqual({
      entry: {
        sessionDate: "2026-11-24",
        cardioType: "walking",
        distanceKm: 3.25,
        durationSeconds: 2400,
        steps: 4200,
        caloriesBurned: 114,
      },
      error: null,
    });
  });

  it("uses manually entered calories for a running session", () => {
    const result = parseManualCardioEntry({
      ...validInput,
      cardioType: "running",
      caloriesBurned: "320.4",
    });

    expect(result.entry?.caloriesBurned).toBe(320);
  });

  it("rejects an impossible calendar date", () => {
    expect(
      parseManualCardioEntry({ ...validInput, sessionDate: "2026-02-30" }),
    ).toMatchObject({ entry: null, error: expect.stringContaining("date") });
  });

  it("rejects fractional or negative steps", () => {
    expect(
      parseManualCardioEntry({ ...validInput, steps: "12.5" }),
    ).toMatchObject({ entry: null, error: expect.stringContaining("whole") });
    expect(
      parseManualCardioEntry({ ...validInput, steps: "-1" }),
    ).toMatchObject({ entry: null, error: expect.stringContaining("whole") });
  });
});
