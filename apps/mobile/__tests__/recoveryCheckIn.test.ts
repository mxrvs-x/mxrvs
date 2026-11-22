import {
  createRecoveryCheckIn,
  recoveryCheckInLines,
} from "../lib/recoveryCheckIn";

describe("workout recovery check-in", () => {
  it("creates complete default and skipped check-ins", () => {
    expect(Object.values(createRecoveryCheckIn(3))).toEqual([3, 3, 3, 3, 3]);
    expect(Object.values(createRecoveryCheckIn())).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("formats only recorded recovery scores", () => {
    expect(
      recoveryCheckInLines({
        recovery_energy: 4,
        recovery_sleep_quality: 5,
        recovery_soreness: 2,
      }),
    ).toEqual(["Energy: 4/5", "Sleep Quality: 5/5", "Soreness: 2/5"]);
  });
});
