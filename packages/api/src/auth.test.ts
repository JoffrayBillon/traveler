import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrevoMagicLinkSender } from "./adapters/email/brevo-magic-link.adapter";
import { createApp } from "./app";
import { createAuth, createMagicLinkCapture } from "./auth";
import { createAuthServicesProvider } from "./composition";
import { EnvironmentValidationError } from "./environment";
import { createManagersStore } from "./managers";
import * as schema from "./schema";
import { updateParticipantEmail } from "./services/participant-management";
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

const brevoMock = vi.hoisted(() => ({
  sendTransacEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@getbrevo/brevo", () => ({
  Brevo: {
    UnauthorizedError: class UnauthorizedError extends Error {},
    ForbiddenError: class ForbiddenError extends Error {},
  },
  BrevoClient: class BrevoClient {
    transactionalEmails = { sendTransacEmail: brevoMock.sendTransacEmail };
  },
  BrevoError: class BrevoError extends Error {
    statusCode = 500;
  },
}));

async function createTestServices(
  sendEmail?: (email: string, url: string) => Promise<void>,
  env: NodeJS.ProcessEnv = authEnv,
  useDefaultSender = false,
) {
  const client = createClient({ url: "file::memory:" });
  clients.push(client);
  const database = drizzle({ client, schema });
  const migrationFiles = (await readdir(migrationsDirectory))
    // This fixture provisions its own accounts and trips.
    .filter(
      (file) =>
        file.endsWith(".sql") && file !== "0012_bootstrap_empty_site.sql",
    )
    .sort();
  for (const file of migrationFiles) {
    const migration = await readFile(join(migrationsDirectory, file), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.execute(statement);
    }
  }
  const backgroundTasks: Promise<unknown>[] = [];
  const magicLinkCapture = createMagicLinkCapture();
  const localEmailSender = sendEmail ?? (async () => {});
  return {
    client,
    database,
    backgroundTasks,
    scheduleBackgroundTask: (task: Promise<unknown>) => {
      backgroundTasks.push(task);
    },
    magicLinkCapture,
    auth: createAuth(
      database,
      env,
      useDefaultSender ? undefined : localEmailSender,
      magicLinkCapture,
    ),
  };
}

function confirmLink(
  app: ReturnType<typeof createApp>,
  link: string,
  origin?: string,
) {
  const url = new URL(link);
  return app.request(link, {
    method: "POST",
    headers: { Origin: origin ?? url.origin },
    body: url.searchParams,
  });
}
async function flushBackgroundTasks(tasks: Promise<unknown>[]) {
  while (tasks.length > 0) await Promise.all(tasks.splice(0));
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

it("requires a manager and the exact email to erase trip data and revoke the last account", async () => {
  const sendEmail = vi
    .fn<(email: string, url: string) => Promise<void>>()
    .mockResolvedValue(undefined);
  const services = await createTestServices(sendEmail);
  const { database } = services;
  const tripStore = createTripsStore(database);
  const firstTrip = await tripStore.create("First");
  const secondTrip = await tripStore.create("Second");
  const managerData = {
    firstName: "Mina",
    lastName: "Manager",
    email: "mina@example.com",
  };
  const manager = await createManagersStore(database).create({
    tripId: firstTrip.id,
    ...managerData,
  });
  await createManagersStore(database).create({
    tripId: secondTrip.id,
    ...managerData,
  });
  const userId = "alex";
  const email = "alex@example.com";
  const now = new Date();
  await database.insert(schema.users).values({
    id: userId,
    name: "Alex Traveler",
    email,
    createdAt: now,
    updatedAt: now,
  });
  await database.insert(schema.tripMemberships).values(
    [firstTrip, secondTrip].map((trip) => ({
      id: `alex-${trip.id}`,
      tripId: trip.id,
      userId,
      role: "traveler" as const,
      firstName: "Alex",
      lastName: "Traveler",
      gender: "F" as const,
      genderConfirmed: true,
    })),
  );
  await database.insert(schema.tripRegistrations).values([
    {
      id: "booking1",
      tripId: firstTrip.id,
      userId,
      reference: "BOOK1",
      sourceEmail: email,
      firstName: "Alex",
      lastName: "Traveler",
    },
    {
      id: "booking2",
      tripId: secondTrip.id,
      userId,
      reference: "BOOK2",
      sourceEmail: email,
      firstName: "Alex",
      lastName: "Traveler",
    },
  ]);
  await database.insert(schema.rooms).values({
    id: "room",
    tripId: firstTrip.id,
    name: "01",
    capacity: 2,
    isLocked: true,
    genderPolicy: "single_gender",
  });
  await database.insert(schema.roomAssignments).values([
    { id: "assignment-alex", tripId: firstTrip.id, roomId: "room", userId },
    {
      id: "assignment-manager",
      tripId: firstTrip.id,
      roomId: "room",
      userId: manager.userId,
    },
  ]);
  await database.insert(schema.roomChangeRequests).values({
    id: "room-request",
    tripId: firstTrip.id,
    requesterUserId: manager.userId,
    changesJson: JSON.stringify({ moves: [], roomVersions: {} }),
    requiredConsentsJson: JSON.stringify([userId]),
    approvedConsentsJson: "[]",
    expiresAt: now,
  });
  await database.insert(schema.roomAssignmentHistory).values({
    id: "room-history",
    tripId: firstTrip.id,
    actorUserId: manager.userId,
    actorName: "Mina Manager",
    actionType: "organizer_move",
    changesJson: JSON.stringify([
      { userId, personName: "Alex Traveler" },
      { userId: manager.userId, personName: "Mina Manager" },
    ]),
  });
  await database.insert(schema.travelerDetails).values([
    {
      tripId: firstTrip.id,
      userId,
      transportChoice: "none",
      carpoolRole: "driver",
    },
    {
      tripId: firstTrip.id,
      userId: manager.userId,
      transportChoice: "none",
      carpoolRole: "passenger",
      carpoolDriverUserId: userId,
    },
  ]);
  await database.insert(schema.transportTickets).values([
    {
      id: "alex-ticket",
      tripId: firstTrip.id,
      userId,
      blobPath: "local/alex-ticket",
      kind: "outbound",
      originalName: "ticket.pdf",
      contentType: "application/pdf",
      size: 1,
      uploadedBy: manager.userId,
    },
    {
      id: "manager-ticket",
      tripId: firstTrip.id,
      userId: manager.userId,
      blobPath: "local/manager-ticket",
      kind: "outbound",
      originalName: "ticket.pdf",
      contentType: "application/pdf",
      size: 1,
      uploadedBy: userId,
    },
  ]);

  const deleteBlob = vi
    .fn()
    .mockRejectedValueOnce(new Error("storage unavailable"))
    .mockResolvedValue(undefined);
  const app = createApp(
    () => services.client,
    () => services,
    {
      authEnvironment: { ...authEnv, CRON_SECRET: "test-cron-secret" },
      ticketStorage: { put: vi.fn(), get: vi.fn(), del: deleteBlob },
    },
  );
  async function signIn(address: string) {
    const response = await app.request("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: String(authEnv.BETTER_AUTH_URL),
      },
      body: JSON.stringify({ email: address, callbackURL: "/" }),
    });
    expect(response.status).toBe(200);
    await flushBackgroundTasks(services.backgroundTasks);
    const link = sendEmail.mock.calls.at(-1)?.[1];
    expect(link).toBeTruthy();
    const verification = await confirmLink(app, String(link));
    const cookie = verification.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();
    return cookie ?? "";
  }
  const managerCookie = await signIn(managerData.email);
  const travelerCookie = await signIn(email);
  await database.insert(schema.verifications).values({
    id: "unused-link",
    identifier: "magic-link:unused",
    value: JSON.stringify({ type: "magic-link", email }),
    expiresAt: new Date(now.getTime() + 3600000),
    createdAt: now,
    updatedAt: now,
  });
  function remove(
    tripId: string,
    cookie: string,
    confirmation = email,
    target = userId,
  ) {
    return app.request(`/api/trips/${tripId}/participants/${target}`, {
      method: "DELETE",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ email: confirmation }),
    });
  }

  expect((await remove(firstTrip.id, travelerCookie)).status).toBe(403);
  expect(
    (
      await remove(
        firstTrip.id,
        managerCookie,
        managerData.email,
        manager.userId,
      )
    ).status,
  ).toBe(403);
  expect(
    (await remove(firstTrip.id, managerCookie, "other@example.com")).status,
  ).toBe(409);

  await database.insert(schema.transportGroups).values({
    id: "group-paris",
    tripId: firstTrip.id,
    name: "Paris",
    sourceCity: "Paris",
    normalizedCity: "paris",
  });
  await database.insert(schema.transportGroupAssignments).values({
    tripId: firstTrip.id,
    groupId: "group-paris",
    userId,
    assignedBy: manager.userId,
  });
  await services.client.execute("PRAGMA foreign_keys=OFF");
  const removed = await remove(firstTrip.id, managerCookie, "ALEX@example.com");
  expect(removed.status).toBe(200);
  expect(await removed.json()).toEqual({ status: "deleted" });
  expect(
    await database.select().from(schema.transportGroupAssignments),
  ).toEqual([]);
  expect(await database.select().from(schema.tripRegistrations)).toEqual([
    expect.objectContaining({ id: "booking2", userId }),
  ]);
  expect(await database.select().from(schema.roomChangeRequests)).toEqual([]);
  expect(
    (await database.select().from(schema.roomAssignmentHistory)).map(
      ({ changesJson }) => JSON.parse(changesJson),
    ),
  ).toEqual([[{ userId: manager.userId, personName: "Mina Manager" }]]);
  expect(await database.select().from(schema.rooms)).toEqual([
    expect.objectContaining({ isLocked: false }),
  ]);
  expect(await database.select().from(schema.roomAssignments)).toEqual([
    expect.objectContaining({ userId: manager.userId }),
  ]);
  expect(await database.select().from(schema.travelerDetails)).toEqual([
    expect.objectContaining({
      userId: manager.userId,
      carpoolRole: "undecided",
      carpoolDriverUserId: null,
    }),
  ]);
  expect(await database.select().from(schema.transportTickets)).toEqual([
    expect.objectContaining({ id: "manager-ticket", uploadedBy: null }),
  ]);

  await flushBackgroundTasks(services.backgroundTasks);
  expect(
    await database.select().from(schema.pendingTicketBlobDeletions),
  ).toEqual([{ blobPath: "local/alex-ticket", availableAt: 0 }]);
  expect(deleteBlob).toHaveBeenNthCalledWith(1, "local/alex-ticket");
  const retry = await app.request("/api/cron/delete-expired-tickets", {
    headers: { Authorization: "Bearer test-cron-secret" },
  });
  expect(await retry.json()).toMatchObject({ deleted: 1, failed: 0 });
  expect(deleteBlob).toHaveBeenNthCalledWith(2, "local/alex-ticket");
  expect(
    await database.select().from(schema.pendingTicketBlobDeletions),
  ).toEqual([]);

  expect(
    (await app.request("/api/me", { headers: { Cookie: travelerCookie } }))
      .status,
  ).toBe(200);
  expect((await remove(secondTrip.id, managerCookie)).status).toBe(200);
  expect(
    await database
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId)),
  ).toEqual([]);
  expect(
    await database
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId)),
  ).toEqual([]);
  expect(
    await database
      .select()
      .from(schema.verifications)
      .where(eq(schema.verifications.id, "unused-link")),
  ).toEqual([]);
  expect(
    (await app.request("/api/me", { headers: { Cookie: travelerCookie } }))
      .status,
  ).toBe(401);
});

describe("invite-only magic-link authentication", () => {
  it("reports every missing API setting once when services initialize", () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    const getServices = createAuthServicesProvider({});

    expect(getServices()).toBeUndefined();
    expect(getServices()).toBeUndefined();
    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0]?.[0]).toContain("TURSO_DATABASE_URL");
    expect(report.mock.calls[0]?.[0]).toContain("BETTER_AUTH_SECRET");
    expect(report.mock.calls[0]?.[0]).toContain("BREVO_API_KEY");
    expect(report.mock.calls[0]?.[0]).toContain("BREVO_SENDER_EMAIL");
    report.mockRestore();
  });

  it("requires Brevo configuration when using its default email sender", async () => {
    const services = await createTestServices(vi.fn());
    try {
      createAuth(services.database, authEnv);
      expect.fail("Expected missing Brevo variables to be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      expect((error as EnvironmentValidationError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ variable: "BREVO_API_KEY" }),
          expect.objectContaining({ variable: "BREVO_SENDER_EMAIL" }),
        ]),
      );
    }
  });

  it("normalizes an existing mixed-case address before Better Auth verifies it", async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const services = await createTestServices(sendEmail);
    const trip = await createTripsStore(services.database).create("Ski 2027");
    const now = new Date();
    await services.database.insert(schema.users).values({
      id: "mixed-case-user",
      name: "Alex Voyageur",
      email: "Alex.Voyageur@Example.com",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    await services.database.insert(schema.tripMemberships).values({
      id: "mixed-case-membership",
      tripId: trip.id,
      userId: "mixed-case-user",
      role: "traveler",
      firstName: "Alex",
      lastName: "Voyageur",
      gender: "M",
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
      body: JSON.stringify({ email: " ALEX.VOYAGEUR@EXAMPLE.COM " }),
    });
    await flushBackgroundTasks(services.backgroundTasks);

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0]?.[0]).toBe("alex.voyageur@example.com");
    const [user] = await services.database
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, "mixed-case-user"));
    expect(user?.email).toBe("alex.voyageur@example.com");
    const verified = await confirmLink(
      app,
      sendEmail.mock.calls[0]?.[1] as string,
    );
    expect(verified.headers.get("set-cookie")).toContain(
      "better-auth.session_token",
    );
  });

  it("matches and lowercases a pre-existing manager address", async () => {
    const { database } = await createTestServices();
    const trip = await createTripsStore(database).create("Ski 2027");
    const now = new Date();
    await database.insert(schema.users).values({
      id: "existing-manager",
      name: "Mina Manager",
      email: "Mina.Manager@Example.com",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    const manager = await createManagersStore(database).create({
      tripId: trip.id,
      email: " MINA.MANAGER@EXAMPLE.COM ",
      firstName: "Mina",
      lastName: "Manager",
    });

    expect(manager.userId).toBe("existing-manager");
    expect(manager.email).toBe("mina.manager@example.com");
    expect(await database.select().from(schema.users)).toHaveLength(1);
    const [user] = await database
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, "existing-manager"));
    expect(user?.email).toBe("mina.manager@example.com");
  });

  it("sends the default login email through Brevo with the expected content", async () => {
    brevoMock.sendTransacEmail.mockClear();
    const apiKey = "test-api-key";
    const senderEmail = "no-reply@example.com";
    const env = {
      ...authEnv,
      BREVO_API_KEY: apiKey,
      BREVO_SENDER_EMAIL: senderEmail,
    } as NodeJS.ProcessEnv;
    const services = await createTestServices(
      createBrevoMagicLinkSender(apiKey, senderEmail),
      env,
    );
    const trip = await createTripsStore(services.database).create("Ski 2027");
    const manager = await createManagersStore(services.database).create({
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
      body: JSON.stringify({ email: manager.email, callbackURL: "/" }),
    });
    expect(response.status).toBe(200);
    await flushBackgroundTasks(services.backgroundTasks);

    expect(brevoMock.sendTransacEmail).toHaveBeenCalledOnce();
    const payload = brevoMock.sendTransacEmail.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      sender: { name: "BotMail", email: "no-reply@example.com" },
      to: [{ email: "manager@example.com" }],
      subject: "Votre lien de connexion Traveler",
      textContent: expect.stringContaining(
        "Connectez-vous à votre espace Traveler",
      ),
      htmlContent: expect.stringContaining("Ouvrir mon espace voyage"),
    });
    expect(payload.htmlContent).toContain("href=");
    expect(payload.textContent).toContain("http://127.0.0.1:5173");
  });

  it("lets managers generate a participant link without sending another email", async () => {
    vi.stubEnv("BETTER_AUTH_URL", authEnv.BETTER_AUTH_URL as string);
    vi.stubEnv("VERCEL_URL", "traveler-preview.example.com");
    vi.stubEnv("VERCEL_BRANCH_URL", "");
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const previewEnv = {
      ...authEnv,
      VERCEL_URL: "traveler-preview.example.com",
    } as NodeJS.ProcessEnv;
    const services = await createTestServices(sendEmail, previewEnv);
    const trip = await createTripsStore(services.database).create("Ski 2027");
    const manager = await createManagersStore(services.database).create({
      tripId: trip.id,
      email: "manager@example.com",
      firstName: "Mina",
      lastName: "Manager",
    });
    const participantId = "participant-not-logged-in";
    const now = new Date();
    await services.database.insert(schema.users).values({
      id: participantId,
      name: "Noé Participant",
      email: "participant@example.com",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    await services.database.insert(schema.tripMemberships).values({
      id: "participant-membership",
      tripId: trip.id,
      userId: participantId,
      role: "traveler",
      firstName: "Noé",
      lastName: "Participant",
      gender: "M",
    });
    const app = createApp(
      () => services.client,
      () => services,
    );
    await app.request("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: authEnv.BETTER_AUTH_URL as string,
      },
      body: JSON.stringify({ email: manager.email, callbackURL: "/" }),
    });
    await flushBackgroundTasks(services.backgroundTasks);
    const managerSession = await confirmLink(
      app,
      sendEmail.mock.calls.at(-1)?.[1] as string,
    );
    const managerCookie = managerSession.headers
      .get("set-cookie")
      ?.split(";")[0] as string;

    const managerList = await app.request(
      `/api/trips/${trip.id}/participants/access`,
      { headers: { Cookie: managerCookie } },
    );
    expect(managerList.status).toBe(200);
    expect(await managerList.json()).toMatchObject({
      participants: expect.arrayContaining([
        expect.objectContaining({
          userId: participantId,
          email: "participant@example.com",
          lastLoginAt: null,
        }),
      ]),
    });

    const participantEmail = await app.request("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: {
        Origin: authEnv.BETTER_AUTH_URL as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "participant@example.com",
        callbackURL: "/",
      }),
    });
    expect(participantEmail.status).toBe(200);
    await flushBackgroundTasks(services.backgroundTasks);
    const ownLink = await app.request(
      `/api/trips/${trip.id}/participants/${manager.userId}/login-link`,
      { method: "POST", headers: { Cookie: managerCookie } },
    );
    expect(ownLink.status).toBe(200);
    const sendLink = await app.request(
      `/api/trips/${trip.id}/participants/${participantId}/login-link`,
      {
        method: "POST",
        headers: {
          Cookie: managerCookie,
          Origin: "https://traveler-preview.example.com",
        },
      },
    );
    expect(sendLink.status).toBe(200);
    const generatedLink = (await sendLink.json()).link as string;
    expect(generatedLink).toContain("https://traveler-preview.example.com");
    const repeatedLink = await app.request(
      `/api/trips/${trip.id}/participants/${participantId}/login-link`,
      {
        method: "POST",
        headers: {
          Cookie: managerCookie,
          Origin: "https://traveler-preview.example.com",
        },
      },
    );
    expect(repeatedLink.status).toBe(200);
    expect((await repeatedLink.json()).link).toContain(
      "/api/auth/magic-link/verify",
    );
    expect(sendEmail).toHaveBeenCalledTimes(2);

    const participantSession = await confirmLink(app, generatedLink);
    const participantCookie = participantSession.headers
      .get("set-cookie")
      ?.split(";")[0] as string;
    const participantList = await app.request(
      `/api/trips/${trip.id}/participants/access`,
      { headers: { Cookie: participantCookie } },
    );
    expect(participantList.status).toBe(403);

    const refreshedList = await app.request(
      `/api/trips/${trip.id}/participants/access`,
      { headers: { Cookie: managerCookie } },
    );
    expect(await refreshedList.json()).toMatchObject({
      participants: expect.arrayContaining([
        expect.objectContaining({
          userId: participantId,
          lastLoginAt: expect.any(String),
        }),
      ]),
    });
  });

  it("generates a manager login link without invoking the email sender", async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const services = await createTestServices(sendEmail);
    const trip = await createTripsStore(services.database).create("Ski 2027");
    const manager = await createManagersStore(services.database).create({
      tripId: trip.id,
      email: "manager@example.com",
      firstName: "Mina",
      lastName: "Manager",
    });
    const participantId = "participant-email-failure";
    const now = new Date();
    await services.database.insert(schema.users).values({
      id: participantId,
      name: "Noé Participant",
      email: "participant@example.com",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    await services.database.insert(schema.tripMemberships).values({
      id: "participant-email-failure-membership",
      tripId: trip.id,
      userId: participantId,
      role: "traveler",
      firstName: "Noé",
      lastName: "Participant",
      gender: "M",
    });
    const app = createApp(
      () => services.client,
      () => services,
    );
    await app.request("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: authEnv.BETTER_AUTH_URL as string,
      },
      body: JSON.stringify({ email: manager.email, callbackURL: "/" }),
    });
    await flushBackgroundTasks(services.backgroundTasks);
    const login = await confirmLink(
      app,
      sendEmail.mock.calls[0]?.[1] as string,
    );
    const cookie = login.headers.get("set-cookie")?.split(";")[0] as string;

    const response = await app.request(
      `/api/trips/${trip.id}/participants/${participantId}/login-link`,
      { method: "POST", headers: { Cookie: cookie } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      link: expect.stringContaining("/api/auth/magic-link/verify"),
    });
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("stores staff trip details and exposes them only inside that trip", async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const services = await createTestServices(sendEmail);
    const trip = await createTripsStore(services.database).create("Ski 2027");
    const otherTrip = await createTripsStore(services.database).create(
      "Autre séjour",
    );
    const manager = await createManagersStore(services.database).create({
      tripId: trip.id,
      email: "manager@example.com",
      firstName: "Mina",
      lastName: "Manager",
    });
    const travelerId = "traveler-user";
    const now = new Date();
    await services.database.insert(schema.users).values({
      id: travelerId,
      name: "Alex Voyageur",
      email: "traveler@example.com",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    await services.database.insert(schema.tripMemberships).values({
      id: "trip-membership",
      tripId: trip.id,
      userId: travelerId,
      role: "traveler",
      firstName: "Alex",
      lastName: "Voyageur",
      gender: "M",
    });
    const app = createApp(
      () => services.client,
      () => services,
    );
    const managerLinkResponse = await app.request(
      "/api/auth/sign-in/magic-link",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: authEnv.BETTER_AUTH_URL as string,
        },
        body: JSON.stringify({ email: manager.email, callbackURL: "/" }),
      },
    );
    expect(managerLinkResponse.status).toBe(200);
    await flushBackgroundTasks(services.backgroundTasks);
    const managerLink = sendEmail.mock.calls.at(-1)?.[1];
    expect(managerLink).toBeTruthy();
    const managerSession = await confirmLink(app, managerLink as string);
    const managerCookie = managerSession.headers
      .get("set-cookie")
      ?.split(";")[0];
    expect(managerCookie).toBeTruthy();

    const details = {
      activityProfile: "ski",
      skiDayThree: true,
      transportMode: "none",
      departureCity: null,
      outboundDateTime: null,
      outboundTimezone: null,
      outboundMeetingTime: null,
      outboundDepartureTime: null,
      outboundLocation: null,
      outboundReference: null,
      outboundSeat: null,
      returnDateTime: null,
      returnTimezone: null,
      returnMeetingTime: null,
      returnDepartureTime: null,
      returnLocation: null,
      returnReference: null,
      returnSeat: null,
      carpoolPreference: true,
      parkingPreference: true,
    };
    const saveResponse = await app.request(
      `/api/trips/${trip.id}/travelers/${travelerId}/details`,
      {
        method: "PUT",
        headers: {
          Cookie: managerCookie as string,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(details),
      },
    );
    expect(saveResponse.status).toBe(200);
    expect(await saveResponse.json()).toEqual({ status: "saved" });

    const renameResponse = await app.request(`/api/trips/${trip.id}`, {
      method: "PUT",
      headers: {
        Cookie: managerCookie ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Séjour au ski 2027" }),
    });
    expect(renameResponse.status).toBe(200);
    const appointResponse = await app.request(
      `/api/trips/${trip.id}/companions`,
      {
        method: "POST",
        headers: {
          Cookie: managerCookie ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "Léa",
          lastName: "Accompagnatrice",
          email: "lea@example.com",
        }),
      },
    );
    expect(appointResponse.status).toBe(201);

    const staffList = await app.request(`/api/trips/${trip.id}/travelers`, {
      headers: { Cookie: managerCookie as string },
    });
    expect(staffList.status).toBe(200);
    expect(await staffList.json()).toMatchObject({
      travelers: expect.arrayContaining([
        expect.objectContaining({
          userId: travelerId,
          email: "traveler@example.com",
          activityProfile: "ski",
          skiDayThree: true,
          carpoolPreference: true,
          parkingPreference: true,
        }),
        expect.objectContaining({ email: "manager@example.com" }),
      ]),
    });

    const otherTripAccess = await app.request(
      `/api/trips/${otherTrip.id}/travelers/${travelerId}/details`,
      {
        method: "PUT",
        headers: {
          Cookie: managerCookie as string,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(details),
      },
    );
    expect(otherTripAccess.status).toBe(404);

    const travelerLinkResponse = await app.request(
      "/api/auth/sign-in/magic-link",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: authEnv.BETTER_AUTH_URL as string,
        },
        body: JSON.stringify({
          email: "traveler@example.com",
          callbackURL: "/",
        }),
      },
    );
    expect(travelerLinkResponse.status).toBe(200);
    await flushBackgroundTasks(services.backgroundTasks);
    const travelerLink = sendEmail.mock.calls.at(-1)?.[1];
    const travelerSession = await confirmLink(app, travelerLink as string);
    const travelerCookie = travelerSession.headers
      .get("set-cookie")
      ?.split(";")[0];
    expect(travelerCookie).toBeTruthy();

    await services.database.insert(schema.rooms).values([
      {
        id: "manager-room",
        tripId: trip.id,
        name: "101",
        capacity: 1,
        genderPolicy: "unset",
      },
      {
        id: "traveler-room",
        tripId: trip.id,
        name: "102",
        capacity: 1,
        genderPolicy: "single_gender",
      },
    ]);
    await services.database.insert(schema.roomAssignments).values([
      {
        id: "manager-assignment",
        tripId: trip.id,
        roomId: "manager-room",
        userId: manager.userId,
      },
      {
        id: "traveler-assignment",
        tripId: trip.id,
        roomId: "traveler-room",
        userId: travelerId,
      },
    ]);
    const exchange = await app.request(`/api/trips/${trip.id}/room-requests`, {
      method: "POST",
      headers: {
        Cookie: managerCookie as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetRoomId: "traveler-room",
        exchangeWithEmail: "TRAVELER@example.com",
      }),
    });
    expect(exchange.status).toBe(201);
    const exchangeResult = (await exchange.json()) as {
      request: { id: string; status: string; requiredConsents: string[] };
    };
    expect(exchangeResult.request).toMatchObject({
      status: "pending",
      requiredConsents: [manager.userId, travelerId].sort(),
    });
    const consent = await app.request(
      `/api/trips/${trip.id}/room-requests/${exchangeResult.request.id}/consent`,
      {
        method: "POST",
        headers: {
          Cookie: travelerCookie as string,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approve: true }),
      },
    );
    expect(consent.status).toBe(200);
    expect(await consent.json()).toMatchObject({ status: "applied" });
    const exchangeAssignments = await services.database
      .select({
        userId: schema.roomAssignments.userId,
        roomId: schema.roomAssignments.roomId,
      })
      .from(schema.roomAssignments)
      .where(eq(schema.roomAssignments.tripId, trip.id));
    expect(exchangeAssignments).toEqual(
      expect.arrayContaining([
        { userId: manager.userId, roomId: "traveler-room" },
        { userId: travelerId, roomId: "manager-room" },
      ]),
    );

    await services.database.insert(schema.transportTickets).values({
      id: "private-ticket",
      tripId: trip.id,
      userId: manager.userId,
      kind: "outbound",
      blobPath: "trips/private/ticket",
      originalName: "billet.pdf",
      contentType: "application/pdf",
      size: 100,
      uploadedBy: manager.userId,
    });
    const privateTicket = await app.request(
      `/api/trips/${trip.id}/tickets/private-ticket`,
      { headers: { Cookie: travelerCookie ?? "" } },
    );
    expect(privateTicket.status).toBe(404);
    const deniedUpload = new FormData();
    deniedUpload.set(
      "file",
      new File(["not-a-real-ticket"], "ticket.pdf", {
        type: "application/pdf",
      }),
    );
    deniedUpload.set("kind", "outbound");
    const deniedUploadResponse = await app.request(
      `/api/trips/${trip.id}/travelers/${travelerId}/tickets`,
      {
        method: "POST",
        headers: { Cookie: travelerCookie ?? "" },
        body: deniedUpload,
      },
    );
    expect(deniedUploadResponse.status).toBe(403);
    const forbiddenEdit = await app.request(
      `/api/trips/${trip.id}/travelers/${travelerId}/details`,
      {
        method: "PUT",
        headers: {
          Cookie: travelerCookie as string,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(details),
      },
    );
    expect(forbiddenEdit.status).toBe(403);
    const forbiddenAppointment = await app.request(
      `/api/trips/${trip.id}/companions`,
      {
        method: "POST",
        headers: {
          Cookie: travelerCookie ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "No",
          lastName: "Access",
          email: "no-access@example.com",
        }),
      },
    );
    expect(forbiddenAppointment.status).toBe(403);
  });

  it("rejects incompatible activity, transport and parking combinations", async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const services = await createTestServices(sendEmail);
    const trip = await createTripsStore(services.database).create("Ski 2027");
    const manager = await createManagersStore(services.database).create({
      tripId: trip.id,
      email: "manager@example.com",
      firstName: "Mina",
      lastName: "Manager",
    });
    const app = createApp(
      () => services.client,
      () => services,
    );
    await app.request("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: authEnv.BETTER_AUTH_URL as string,
      },
      body: JSON.stringify({ email: manager.email, callbackURL: "/" }),
    });
    await flushBackgroundTasks(services.backgroundTasks);
    const login = await confirmLink(
      app,
      sendEmail.mock.calls.at(-1)?.[1] as string,
    );
    const cookie = login.headers.get("set-cookie")?.split(";")[0] as string;

    const response = await app.request(
      `/api/trips/${trip.id}/travelers/${manager.userId}/details`,
      {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          activityProfile: "spa",
          skiDayThree: true,
          transportMode: "train",
          departureCity: "Paris",
          outboundDateTime: null,
          outboundTimezone: null,
          outboundMeetingTime: null,
          outboundDepartureTime: null,
          outboundLocation: null,
          outboundReference: null,
          outboundSeat: null,
          returnDateTime: null,
          returnTimezone: null,
          returnMeetingTime: null,
          returnDepartureTime: null,
          returnLocation: null,
          returnReference: null,
          returnSeat: null,
          carpoolPreference: null,
          parkingPreference: null,
        }),
      },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "ski_day_requires_ski_profile",
    });
    expect(
      await services.database.select().from(schema.travelerDetails),
    ).toHaveLength(0);

    const invalidTime = await app.request(
      `/api/trips/${trip.id}/travelers/${manager.userId}/details`,
      {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          activityProfile: "ski",
          skiDayThree: false,
          transportMode: "train",
          departureCity: "Paris",
          outboundDateTime: null,
          outboundTimezone: null,
          outboundMeetingTime: "99:99",
          outboundDepartureTime: null,
          outboundLocation: null,
          outboundReference: null,
          outboundSeat: null,
          returnDateTime: null,
          returnTimezone: null,
          returnMeetingTime: null,
          returnDepartureTime: null,
          returnLocation: null,
          returnReference: null,
          returnSeat: null,
          carpoolPreference: null,
          parkingPreference: null,
        }),
      },
    );
    expect(invalidTime.status).toBe(400);
    expect(await invalidTime.json()).toEqual({ error: "invalid_travel_time" });
  });

  it("uses the stable Vercel branch URL for the magic link and callback", async () => {
    const branchOrigin = "https://traveler-git-dev-example.vercel.app";
    const env = {
      BETTER_AUTH_SECRET: authEnv.BETTER_AUTH_SECRET,
      VERCEL_URL: "traveler-unique-deployment.vercel.app",
      VERCEL_BRANCH_URL: "traveler-git-dev-example.vercel.app",
    } as NodeJS.ProcessEnv;
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const services = await createTestServices(sendEmail, env);
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
        Origin: branchOrigin,
      },
      body: JSON.stringify({
        email: "manager@example.com",
        callbackURL: `${branchOrigin}/`,
      }),
    });
    expect(response.status).toBe(200);
    await flushBackgroundTasks(services.backgroundTasks);

    const magicLink = new URL(sendEmail.mock.calls[0]?.[1] ?? "");
    expect(magicLink.origin).toBe(branchOrigin);
    expect(magicLink.searchParams.get("callbackURL")).toBe(`${branchOrigin}/`);
  });

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
    await flushBackgroundTasks(services.backgroundTasks);
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
    expect(sendEmail).not.toHaveBeenCalled();
    await flushBackgroundTasks(services.backgroundTasks);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0]?.[0]).toBe("manager@example.com");

    const magicLink = new URL(sendEmail.mock.calls[0]?.[1] ?? "");
    const previewUrl = new URL(
      "http://127.0.0.1:3001/api/auth/magic-link/preview",
    );
    const preview = () =>
      app.request(previewUrl.href, {
        method: "POST",
        headers: {
          Origin: magicLink.origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: magicLink.searchParams.get("token") }),
      });
    for (const method of ["GET", "HEAD", "GET"]) {
      const scanned = await app.request(magicLink.href, { method });
      expect(scanned.status).toBe(302);
      expect(scanned.headers.get("location")).toContain(
        "/sign-in/confirm#token=",
      );
      expect(scanned.headers.get("set-cookie")).toBeNull();
      expect(scanned.headers.get("cache-control")).toContain("no-store");
    }
    for (const path of [
      "/api/auth/magic-link/verify/",
      "/api/auth//magic-link/verify",
      "/api/auth/%6dagic-link/verify",
    ]) {
      const alias = new URL(magicLink);
      alias.pathname = path;
      const response = await app.request(alias.href);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
    expect(await (await preview()).json()).toEqual({
      firstName: "Mina",
      lastName: "Manager",
    });
    expect(await (await preview()).json()).toEqual({
      firstName: "Mina",
      lastName: "Manager",
    });
    expect(
      await services.database.select().from(schema.verifications),
    ).toHaveLength(1);
    expect(await services.database.select().from(schema.sessions)).toHaveLength(
      0,
    );
    const [pending] = await services.database
      .select()
      .from(schema.verifications);
    if (!pending) throw new Error("Expected a pending verification");
    expect(pending.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + 59 * 60 * 1000,
    );
    expect(pending?.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 60 * 60 * 1000,
    );
    expect(
      (await confirmLink(app, magicLink.href, "https://attacker.example.com"))
        .status,
    ).toBe(403);
    expect(
      (
        await app.request(magicLink.href, {
          method: "POST",
          body: magicLink.searchParams,
        })
      ).status,
    ).toBe(403);
    const unsafeCallback = new URL(magicLink);
    unsafeCallback.searchParams.set(
      "callbackURL",
      "https://attacker.example.com",
    );
    expect((await confirmLink(app, unsafeCallback.href)).status).toBe(403);
    expect(
      await services.database.select().from(schema.verifications),
    ).toHaveLength(1);
    await services.database
      .update(schema.verifications)
      .set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await preview()).status).toBe(410);
    const expired = await confirmLink(app, magicLink.href);
    expect(expired.headers.get("set-cookie")).toBeNull();
    expect(expired.headers.get("location")).toContain("error=INVALID_TOKEN");
    await services.database.delete(schema.verifications);
    await services.database.insert(schema.verifications).values(pending);
    const internalVerificationUrl = new URL(magicLink);
    internalVerificationUrl.port = "3001";
    const verificationResponse = await confirmLink(
      app,
      internalVerificationUrl.href,
      magicLink.origin,
    );
    expect(verificationResponse.status).toBe(302);
    const cookie = verificationResponse.headers
      .get("set-cookie")
      ?.split(";")[0];
    expect(cookie).toBeTruthy();
    expect(await services.database.select().from(schema.sessions)).toHaveLength(
      1,
    );

    await confirmLink(app, magicLink.href);
    expect(await services.database.select().from(schema.sessions)).toHaveLength(
      1,
    );

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
    await flushBackgroundTasks(services.backgroundTasks);
    expect(logError).toHaveBeenCalledWith(
      "Magic link email delivery failed.",
      "Error",
    );
    logError.mockRestore();
  });

  it.each(["role", "membership"] as const)(
    "aborts a ticket when uploader %s changes after storage upload",
    async (changed) => {
      const sendEmail = vi
        .fn<(email: string, url: string) => Promise<void>>()
        .mockResolvedValue(undefined);
      const services = await createTestServices(sendEmail);
      const trip = await createTripsStore(services.database).create(
        "Test trip",
      );
      const manager = await createManagersStore(services.database).create({
        tripId: trip.id,
        email: "manager@example.com",
        firstName: "Mina",
        lastName: "Manager",
      });
      const del = vi
        .fn()
        .mockRejectedValueOnce(new Error("temporary storage failure"))
        .mockResolvedValue(undefined);
      const put = vi.fn(async (blobPath: string) => {
        const [intent] = await services.database
          .select()
          .from(schema.pendingTicketBlobDeletions);
        expect(intent?.blobPath).toBe(blobPath);
        expect(intent?.availableAt).toBeGreaterThan(Date.now());
        const during = await runRetention();
        expect(await during.json()).toEqual({ deleted: 0, failed: 0 });
        const memberships = schema.tripMemberships;
        if (changed === "role") {
          await services.database
            .update(memberships)
            .set({ role: "traveler" })
            .where(eq(memberships.userId, manager.userId));
        } else {
          const [member] = await services.database
            .delete(memberships)
            .where(eq(memberships.userId, manager.userId))
            .returning();
          if (!member) throw new Error("Expected original membership");
          await services.database.insert(memberships).values({
            ...member,
            id: "replacement-membership",
          });
        }
      });
      const app = createApp(
        () => services.client,
        () => services,
        {
          authEnvironment: { ...authEnv, CRON_SECRET: "test-cron-secret" },
          ticketStorage: { put, get: vi.fn(), del },
          ticketStorageAvailable: () => true,
        },
      );
      function runRetention() {
        return app.request("/api/cron/delete-expired-tickets", {
          headers: { Authorization: "Bearer test-cron-secret" },
        });
      }
      await app.request("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: String(authEnv.BETTER_AUTH_URL),
        },
        body: JSON.stringify({ email: manager.email }),
      });
      await flushBackgroundTasks(services.backgroundTasks);
      const login = await confirmLink(app, sendEmail.mock.calls[0]?.[1] ?? "");
      const cookie = login.headers.get("set-cookie")?.split(";")[0];
      if (!cookie) throw new Error("Expected a manager session");

      const form = new FormData();
      form.set("kind", "outbound");
      form.set(
        "file",
        new File(["ticket"], "ticket.pdf", { type: "application/pdf" }),
      );
      const upload = await app.request(
        `/api/trips/${trip.id}/travelers/${manager.userId}/tickets`,
        {
          method: "POST",
          headers: { Cookie: cookie },
          body: form,
        },
      );
      expect(upload.status).toBe(503);
      expect(await upload.json()).toEqual({ error: "ticket_upload_failed" });
      expect(
        await services.database.select().from(schema.transportTickets),
      ).toEqual([]);
      const [intent] = await services.database
        .select()
        .from(schema.pendingTicketBlobDeletions);
      expect(intent?.availableAt).toBe(0);
      expect(put).toHaveBeenCalledOnce();
      expect(del).toHaveBeenNthCalledWith(1, intent?.blobPath);
      const retry = await runRetention();
      expect(await retry.json()).toEqual({ deleted: 1, failed: 0 });
      expect(del).toHaveBeenNthCalledWith(2, intent?.blobPath);
    },
  );

  it("revokes a hashed magic-link record for the old email on address correction", async () => {
    const services = await createTestServices();
    const trip = await createTripsStore(services.database).create("Test trip");
    const account = await createManagersStore(services.database).create({
      tripId: trip.id,
      email: "old@example.com",
      firstName: "Mina",
      lastName: "Manager",
    });
    const now = new Date();
    const values = {
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    };
    await services.database.insert(schema.verifications).values([
      {
        ...values,
        id: "old",
        identifier: "magic-link:hashed-old",
        value: JSON.stringify({ type: "magic-link", email: account.email }),
      },
      {
        ...values,
        id: "other",
        identifier: "magic-link:hashed-other",
        value: JSON.stringify({
          type: "magic-link",
          email: "other@example.com",
        }),
      },
    ]);
    expect(
      await updateParticipantEmail(
        services.database,
        trip.id,
        account.userId,
        "new@example.com",
      ),
    ).toMatchObject({ status: "updated" });
    expect(
      await services.database
        .select({ id: schema.verifications.id })
        .from(schema.verifications),
    ).toEqual([{ id: "other" }]);
  });

  it("checks the network quota before reserving the address and rejects noncanonical sign-in paths", async () => {
    const services = await createTestServices();
    const app = createApp(
      () => services.client,
      () => services,
    );
    const requestLink = (email: string, suffix = "") =>
      app.request(`/api/auth/sign-in/magic-link${suffix}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: String(authEnv.BETTER_AUTH_URL),
          "X-Forwarded-For": "198.51.100.21",
        },
        body: JSON.stringify({ email }),
      });

    expect((await requestLink("later@example.com", "/")).status).toBe(404);
    expect(
      await services.database.select().from(schema.signInRateLimits),
    ).toEqual([]);
    for (let i = 0; i < 5; i++) {
      expect((await requestLink(`person${i}@example.com`)).status).toBe(200);
      await flushBackgroundTasks(services.backgroundTasks);
    }
    const rejected = await requestLink("later@example.com");
    expect(rejected.status).toBe(429);
    expect(Number(rejected.headers.get("Retry-After"))).toBeLessThanOrEqual(60);
    await services.database
      .update(schema.signInRateLimits)
      .set({ expiresAt: Date.now() - 1 })
      .where(like(schema.signInRateLimits.key, "network:%"));
    expect((await requestLink("later@example.com")).status).toBe(200);
    await flushBackgroundTasks(services.backgroundTasks);
  });

  it("rolls back token consumption when session creation fails and retries the same link", async () => {
    const sendEmail = vi
      .fn<(email: string, url: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    const services = await createTestServices(sendEmail);
    const trip = await createTripsStore(services.database).create("Test trip");
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
    await app.request("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: String(authEnv.BETTER_AUTH_URL),
      },
      body: JSON.stringify({ email: "manager@example.com", callbackURL: "/" }),
    });
    await flushBackgroundTasks(services.backgroundTasks);
    const link = sendEmail.mock.calls[0]?.[1] ?? "";
    expect(link).toBeTruthy();
    await services.client.execute(
      "CREATE TRIGGER fail_session BEFORE INSERT ON session BEGIN SELECT raise(ABORT, 'simulated session insert failure'); END",
    );
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const failed = await confirmLink(app, link);
      expect(failed.headers.get("set-cookie")).toBeNull();
      expect(
        await services.database.select().from(schema.verifications),
      ).toHaveLength(1);
      expect(
        await services.database.select().from(schema.sessions),
      ).toHaveLength(0);
    } finally {
      logger.mockRestore();
      await services.client.execute("DROP TRIGGER fail_session");
    }

    const retry = await confirmLink(app, link);
    expect(retry.headers.get("set-cookie")).toBeTruthy();
    expect(retry.headers.get("Cache-Control")).toBe("private, no-store");
    expect(retry.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect((await confirmLink(app, link)).headers.get("set-cookie")).toBeNull();
  });

  it("limits each email address to one magic-link request every five minutes", async () => {
    const services = await createTestServices(
      vi.fn().mockResolvedValue(undefined),
    );
    const app = createApp(
      () => services.client,
      () => services,
    );
    const requestLink = () =>
      app.request("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: authEnv.BETTER_AUTH_URL as string,
          "X-Forwarded-For": "198.51.100.42",
        },
        body: JSON.stringify({
          email: "unknown@example.com",
          callbackURL: "/",
        }),
      });

    const firstResponse = await requestLink();
    expect(firstResponse.status).toBe(200);
    expect(await firstResponse.json()).toEqual({ status: "accepted" });
    await flushBackgroundTasks(services.backgroundTasks);

    const secondResponse = await requestLink();
    expect(secondResponse.status).toBe(429);
    expect(await secondResponse.json()).toEqual({ error: "rate_limited" });
    const retryAfter = Number(secondResponse.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(300);
    await services.database
      .update(schema.rateLimits)
      .set({ lastRequest: Date.now() - 61_000 });
    expect((await requestLink()).status).toBe(429);
    await services.database
      .update(schema.signInRateLimits)
      .set({ expiresAt: Date.now() - 1 });
    expect((await requestLink()).status).toBe(200);
    await flushBackgroundTasks(services.backgroundTasks);
  });
});
