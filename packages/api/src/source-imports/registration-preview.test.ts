import { describe, expect, it } from "vitest";
import { compareRegistrationFields } from "./registration-preview";

describe("registration preview", () => {
  it("shows payment changes and preserves zero amounts", () => {
    const before = { status: "validated", amountDueMinor: 4500 };
    const after = { status: "validated", amountDueMinor: 0 };
    expect(
      compareRegistrationFields(["status", "amountDueMinor"], before, after),
    ).toEqual([{ field: "amountDueMinor", before: 4500, after: 0 }]);
  });

  it("shows removed values and a third day explicitly turned off", () => {
    expect(
      compareRegistrationFields(
        ["departureCity", "skiDayThree"],
        { departureCity: "Paris", skiDayThree: true },
        { departureCity: null, skiDayThree: false },
      ),
    ).toEqual([
      { field: "departureCity", before: "Paris", after: null },
      { field: "skiDayThree", before: true, after: false },
    ]);
  });
});
