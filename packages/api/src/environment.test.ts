import { describe, expect, it } from "vitest";
import {
  EnvironmentValidationError,
  formatEnvironmentReport,
  getEnvironmentWarnings,
  validateEnvironment,
} from "./environment";

describe("environment validation", () => {
  it("reports all missing API settings together without showing values", () => {
    let validationError: EnvironmentValidationError | undefined;
    try {
      validateEnvironment("api", {});
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        validationError = error;
      }
    }

    expect(validationError).toBeInstanceOf(EnvironmentValidationError);
    expect(validationError?.issues.map(({ variable }) => variable)).toEqual(
      expect.arrayContaining([
        "TURSO_DATABASE_URL",
        "TURSO_AUTH_TOKEN",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
        "BREVO_API_KEY",
        "BREVO_SENDER_EMAIL",
      ]),
    );
    const report = formatEnvironmentReport(
      validationError?.profile ?? "api",
      validationError?.issues ?? [],
    );
    expect(report).toContain("Database:");
    expect(report).toContain("Authentication:");
    expect(report).toContain("Email delivery:");
  });

  it("validates only database settings for database commands", () => {
    let validationError: EnvironmentValidationError | undefined;
    try {
      validateEnvironment("database", {});
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        validationError = error;
      }
    }

    expect(validationError?.issues.map(({ variable }) => variable)).toEqual([
      "TURSO_DATABASE_URL",
      "TURSO_AUTH_TOKEN",
    ]);
  });

  it("reports malformed and too-short values together", () => {
    let validationError: EnvironmentValidationError | undefined;
    try {
      validateEnvironment("api", {
        TURSO_DATABASE_URL: "https://not-libsql.example",
        TURSO_AUTH_TOKEN: "db-token",
        BETTER_AUTH_SECRET: "short",
        BETTER_AUTH_URL: "not a URL",
        BREVO_API_KEY: "api-key",
        BREVO_SENDER_EMAIL: "not-an-email",
      });
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        validationError = error;
      }
    }

    expect(validationError?.issues.map(({ variable }) => variable)).toEqual(
      expect.arrayContaining([
        "TURSO_DATABASE_URL",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
        "BREVO_SENDER_EMAIL",
      ]),
    );
    const report = formatEnvironmentReport(
      validationError?.profile ?? "api",
      validationError?.issues ?? [],
    );
    expect(report).not.toContain("db-token");
    expect(report).not.toContain("short");
    expect(report).not.toContain("api-key");
  });

  it("trims secret and Brevo key before validating minimum lengths", () => {
    let validationError: EnvironmentValidationError | undefined;
    try {
      validateEnvironment("api", {
        TURSO_DATABASE_URL: "libsql://example.turso.io",
        TURSO_AUTH_TOKEN: "db-token",
        BETTER_AUTH_SECRET: `${"s".repeat(31)}${" ".repeat(10)}`,
        BETTER_AUTH_URL: "https://traveler.example.com",
        BREVO_API_KEY: "   ",
        BREVO_SENDER_EMAIL: "no-reply@example.com",
      });
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        validationError = error;
      }
    }

    expect(validationError?.issues.map(({ variable }) => variable)).toEqual(
      expect.arrayContaining(["BETTER_AUTH_SECRET", "BREVO_API_KEY"]),
    );
  });

  it("requires at least one trusted auth origin in the API profile", () => {
    let validationError: EnvironmentValidationError | undefined;
    try {
      validateEnvironment("api", {
        TURSO_DATABASE_URL: "libsql://example.turso.io",
        TURSO_AUTH_TOKEN: "db-token",
        BETTER_AUTH_SECRET: "test-secret-with-more-than-thirty-two-characters",
        BREVO_API_KEY: "api-key",
        BREVO_SENDER_EMAIL: "no-reply@example.com",
      });
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        validationError = error;
      }
    }

    expect(validationError?.issues).toContainEqual(
      expect.objectContaining({ variable: "BETTER_AUTH_URL" }),
    );
  });

  it("does not require Brevo when tests inject an email sender", () => {
    expect(
      validateEnvironment("auth-injected", {
        BETTER_AUTH_URL: "http://127.0.0.1:5173",
        BETTER_AUTH_SECRET: "test-secret-with-more-than-thirty-two-characters",
      }),
    ).toMatchObject({ BETTER_AUTH_URL: "http://127.0.0.1:5173" });
  });

  it("warns about local Blob setup without making it block the API", () => {
    expect(getEnvironmentWarnings("api", {})).toEqual([
      expect.objectContaining({ variable: "BLOB_READ_WRITE_TOKEN" }),
    ]);
    expect(
      getEnvironmentWarnings("api", {
        VERCEL: "1",
      }),
    ).toEqual([]);
    expect(getEnvironmentWarnings("database", {})).toEqual([]);
  });
});
