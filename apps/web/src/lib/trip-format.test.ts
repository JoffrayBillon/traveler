import { describe, expect, it } from "vitest";
import { formatJourneyDate } from "./trip-format";

describe("formatJourneyDate", () => {
  it("keeps the stored calendar date and the explicit departure time", () => {
    expect(formatJourneyDate("2026-01-01T23:30:00-05:00", "23:30")).toBe(
      "1 janv. 2026 · 23:30",
    );
  });

  it("uses the stored time when no separate departure time is available", () => {
    expect(formatJourneyDate("2026-01-01T08:15:00Z", null)).toBe(
      "1 janv. 2026 · 08:15",
    );
  });

  it("falls back to the time-only label or unparseable stored value", () => {
    expect(formatJourneyDate(null, "08:15")).toBe("08:15");
    expect(formatJourneyDate("date invalide", null)).toBe("date invalide");
  });
});
