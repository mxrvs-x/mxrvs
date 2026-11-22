import { toLocalDateKey } from "../lib/dates";

describe("toLocalDateKey", () => {
  it("formats a local calendar date as YYYY-MM-DD", () => {
    expect(toLocalDateKey(new Date(2026, 10, 21, 23, 59, 59))).toBe(
      "2026-11-21",
    );
  });

  it("pads single-digit months and days", () => {
    expect(toLocalDateKey(new Date(2026, 0, 2))).toBe("2026-01-02");
  });

  it("uses the supplied date instead of the current clock", () => {
    expect(toLocalDateKey(new Date(1999, 11, 31))).toBe("1999-12-31");
  });
});
