import { isMacroDate, parseMacros } from "../lib/dailyMacros";

const draft = { calories: "2000", protein_g: "125.5", carbs_g: "220,25", fat_g: "0" };

describe("daily macros", () => {
  it("accepts zero and decimal totals in either decimal notation", () => {
    expect(parseMacros(draft)).toEqual({
      values: { calories: 2000, protein_g: 125.5, carbs_g: 220.25, fat_g: 0 },
    });
  });

  it.each(["", "-5", "1e2", "1.001", "10000000000"])(
    "rejects invalid input %j instead of replacing the saved total",
    (fat_g) => {
      expect(parseMacros({ ...draft, fat_g })).toHaveProperty("error");
    },
  );

  it("accepts leap days and rejects dates that would roll over", () => {
    expect(isMacroDate("2024-02-29")).toBe(true);
    expect(isMacroDate("2026-02-29")).toBe(false);
  });
});
