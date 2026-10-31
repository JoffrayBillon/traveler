import { describe, expect, it, vi } from "vitest";
import type { TravelerDetailsInput } from "./app";
import {
  createApp,
  isValidTravelDateTime,
  synchronizeDepartureTimes,
} from "./app";
import { createDatabaseProvider } from "./database";

describe("API boundaries", () => {
  it("reports liveness without leaking configuration", async () => {
    const getDatabase = vi.fn(() => undefined);
    const app = createApp(getDatabase);
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  it("reports readiness when the database query succeeds", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const app = createApp(() => ({ execute }));

    const response = await app.request("/api/ready");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ready" });
    expect(execute).toHaveBeenCalledWith("SELECT 1");
  });

  it("reports not ready when database configuration is missing", async () => {
    const app = createApp(() => undefined);

    const response = await app.request("/api/ready");

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "not_ready" });
  });

  it("reports not ready without exposing database errors", async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new Error("private connection details"));
    const app = createApp(() => ({ execute }));

    const response = await app.request("/api/ready");
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "not_ready" });
    expect(JSON.stringify(body)).not.toContain("private connection details");
  });

  it("returns a structured 404 for an unknown endpoint", async () => {
    const app = createApp(() => undefined);
    const response = await app.request("/api/missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("does not accept writes to the liveness endpoint", async () => {
    const app = createApp(() => undefined);
    const response = await app.request("/api/health", { method: "POST" });
    expect(response.status).toBe(404);
  });
});

describe("travel date-time validation", () => {
  it("validates numeric timezone offsets and years below 100", () => {
    expect(isValidTravelDateTime("2026-12-31T20:00+23:59")).toBe(true);
    expect(isValidTravelDateTime("2026-12-31T20:00+99:99")).toBe(false);
    expect(isValidTravelDateTime("0000-02-29T20:00Z")).toBe(true);
    expect(isValidTravelDateTime("0099-02-29T20:00Z")).toBe(false);
  });

  it("keeps the date and explicit time fields synchronized", () => {
    const details = {
      outboundDateTime: "2026-12-24T06:30:00+01:00",
      outboundDepartureTime: "08:15",
      returnDateTime: null,
      returnDepartureTime: null,
    } as TravelerDetailsInput;

    expect(synchronizeDepartureTimes(details)).toMatchObject({
      outboundDateTime: "2026-12-24T08:15:00+01:00",
      outboundDepartureTime: "08:15",
      returnDateTime: null,
    });
  });
});

describe("Turso configuration", () => {
  it("does not create a client when either credential is missing", () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(createDatabaseProvider({})()).toBeUndefined();
    expect(
      createDatabaseProvider({ TURSO_DATABASE_URL: "libsql://dev.turso.io" })(),
    ).toBeUndefined();
    expect(
      createDatabaseProvider({
        TURSO_DATABASE_URL: "invalid-url",
        TURSO_AUTH_TOKEN: "development-token",
      })(),
    ).toBeUndefined();
    expect(report).toHaveBeenCalledTimes(3);
    expect(report.mock.calls[0]?.[0]).toContain("TURSO_DATABASE_URL");
    expect(report.mock.calls[0]?.[0]).toContain("TURSO_AUTH_TOKEN");
    report.mockRestore();
  });

  it("creates the client lazily and reuses it", () => {
    const getDatabase = createDatabaseProvider({
      TURSO_DATABASE_URL: "libsql://dev.turso.io",
      TURSO_AUTH_TOKEN: "development-token",
    });

    const database = getDatabase();

    expect(database).toBeDefined();
    expect(getDatabase()).toBe(database);
  });
});
