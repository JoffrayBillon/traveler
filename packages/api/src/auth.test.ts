import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { createManagersStore } from "./managers";
import * as schema from "./schema";
import { createTripsStore } from "./trips";

const clients: ReturnType<typeof createClient>[] = [];
const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../drizzle",
);
const authEnv = {
  BETTER_AUTH_URL: "http://127.0.0.1:5173",
  BETTER_AUTH_SECRET: "test-secret-with-more-than-thirty-two-characters",
} as NodeJS.ProcessEnv;

async function createTestServices(
  sendEmail: (email: string, url: string) => Promise<void>,
) {
  const client = createClient({ url: "file::memory:" });
  clients.push(client);
  const database = drizzle({ client, schema });
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrationFiles) {
    const migration = await readFile(join(migrationsDirectory, file), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.execute(statement);
    }
  }
  const backgroundTasks: Promise<void>[] = [];
  return {
    client,
    database,
    backgroundTasks,
    auth: createAuth(database, authEnv, sendEmail, (task) => {
      backgroundTasks.push(task);
    }),
  };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("invite-only magic-link authentication", () => {
  it("uses the same acknowledgement for unknown and invited addresses, then exposes only the member's trip", async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const services = await createTestServices(sendEmail);
    const app = createApp(
      () => services.client,
      () => services,
    );
    const requestLink = (email: string) =>
      app.request("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: authEnv.BETTER_AUTH_URL as string,
        },
        body: JSON.stringify({ email, callbackURL: "/" }),
      });

    const unknownResponse = await requestLink("unknown@example.com");
    expect(unknownResponse.status).toBe(200);
    expect(await unknownResponse.json()).toEqual({ status: "accepted" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(
      await services.database.select().from(schema.verifications),
    ).toHaveLength(0);

    const trip = await createTripsStore(services.database).create("Ski 2027");
    await createManagersStore(services.database).create({
      tripId: trip.id,
      email: "manager@example.com",
      firstName: "Mina",
      lastName: "Manager",
    });

    const invitedResponse = await requestLink("MANAGER@example.com");
    expect(invitedResponse.status).toBe(200);
    expect(await invitedResponse.json()).toEqual({ status: "accepted" });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0]?.[0]).toBe("manager@example.com");
    await Promise.all(services.backgroundTasks);

    const magicLink = new URL(sendEmail.mock.calls[0]?.[1] ?? "");
    const verificationResponse = await app.request(magicLink.href);
    expect(verificationResponse.status).toBe(302);
    const cookie = verificationResponse.headers
      .get("set-cookie")
      ?.split(";")[0];
    expect(cookie).toBeTruthy();

    const profileResponse = await app.request("/api/me", {
      headers: { Cookie: cookie ?? "" },
    });
    expect(profileResponse.status).toBe(200);
    expect(await profileResponse.json()).toEqual({
      user: {
        id: expect.any(String),
        name: "Mina Manager",
        email: "manager@example.com",
      },
      trips: [{ tripId: trip.id, tripName: "Ski 2027", role: "manager" }],
    });

    const userRows = await services.database.select().from(schema.users);
    expect(userRows).toHaveLength(1);
  });

  it("returns a generic unavailable response when auth is not configured", async () => {
    const app = createApp(
      () => undefined,
      () => undefined,
    );
    const response = await app.request("/api/auth/sign-in/magic-link", {
      method: "POST",
      body: JSON.stringify({ email: "person@example.com" }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "service_unavailable" });
  });

  it("keeps the generic acknowledgement and logs privately when email delivery fails", async () => {
    const sendEmail = vi.fn().mockRejectedValue(new Error("SMTP failure"));
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const services = await createTestServices(sendEmail);
    const trip = await createTripsStore(services.database).create("Ski 2027");
    await createManagersStore(services.database).create({
      tripId: trip.id,
      email: "manager@example.com",
      firstName: "Mina",
      lastName: "Manager",
    });
    const app = createApp(
      () => services.client,
      () => services,
    );

    const response = await app.request("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: authEnv.BETTER_AUTH_URL as string,
      },
      body: JSON.stringify({ email: "manager@example.com", callbackURL: "/" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "accepted" });
    await Promise.all(services.backgroundTasks);
    expect(logError).toHaveBeenCalledWith(
      "Magic link email delivery failed.",
      "Error",
    );
    logError.mockRestore();
  });
});
