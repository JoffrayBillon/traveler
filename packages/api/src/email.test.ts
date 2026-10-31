import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("trims whitespace and lowercases the full address", () => {
    expect(normalizeEmail("  Joffray.Billon@GMAIL.COM  ")).toBe(
      "joffray.billon@gmail.com",
    );
  });
});
