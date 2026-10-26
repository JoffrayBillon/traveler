import { describe, expect, it } from "vitest";
import app from "./app.ts";

describe("API boundaries", () => {
  it("reports liveness without leaking configuration", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns a structured 404 for an unknown endpoint", async () => {
    const response = await app.request("/api/missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("does not accept writes to the liveness endpoint", async () => {
    const response = await app.request("/api/health", { method: "POST" });
    expect(response.status).toBe(404);
  });
});
