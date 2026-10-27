import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
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

describe("Turso configuration", () => {
  it("does not create a client when either credential is missing", () => {
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
