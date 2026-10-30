import { describe, expect, it } from "vitest";
import { getTripNameFromArgs } from "./trip-name";

describe("getTripNameFromArgs", () => {
  it("ignores a leading argument separator", () => {
    expect(getTripNameFromArgs(["--", "Ski", "2027"])).toBe("Ski 2027");
  });

  it("preserves arguments when no separator is present", () => {
    expect(getTripNameFromArgs(["Ski", "2027"])).toBe("Ski 2027");
  });

  it("trims whitespace from the assembled name", () => {
    expect(getTripNameFromArgs(["  Ski", "2027  "])).toBe("Ski 2027");
  });
});
