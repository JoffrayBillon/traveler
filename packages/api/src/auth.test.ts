import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { createAuth, createAuthServicesProvider } from "./auth";
import { EnvironmentValidationError } from "./environment";
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
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrationFiles) {
    const migration = await readFile(join(migrationsDirectory, file), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.execute(statement);
    }
  }
  const backgroundTasks: Promise<unknown>[] = [];
  return {
    client,
    database,
    backgroundTasks,
    scheduleBackgroundTask: (task: Promise<unknown>) => {
      backgroundTasks.push(task);
    },
    auth: createAuth(
      database,
      env,
      useDefaultSender ? undefined : (sendEmail ?? (async () => {})),
    ),
  };
}

async function flushBackgroundTasks(tasks: Promise<unknown>[]) {
  while (tasks.length > 0) await Promise.all(tasks.splice(0));
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(clients.splice(0).map((client) => client.close()));
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
    const verified = await app.request(sendEmail.mock.calls[0]?.[1] as string);
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
    const env = {
      ...authEnv,
      BREVO_API_KEY: "test-api-key",
      BREVO_SENDER_EMAIL: "no-reply@example.com",
    } as NodeJS.ProcessEnv;
    const services = await createTestServices(undefined, env, true);
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

  it("lets managers track first sign-in and send a participant a fresh login link", async () => {
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
    const managerSession = await app.request(
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
    expect(sendLink.status).toBe(202);
    await flushBackgroundTasks(services.backgroundTasks);
    expect(sendEmail.mock.calls.at(-1)?.[0]).toBe("participant@example.com");
    expect(sendEmail.mock.calls.at(-1)?.[1]).toContain(
      "https://traveler-preview.example.com",
    );

    const participantSession = await app.request(
      sendEmail.mock.calls.at(-1)?.[1] as string,
    );
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

  it("reports manager-triggered login email delivery failures", async () => {
    const sendEmail = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Brevo unavailable"));
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
    const login = await app.request(sendEmail.mock.calls[0]?.[1] as string);
    const cookie = login.headers.get("set-cookie")?.split(";")[0] as string;

    const response = await app.request(
      `/api/trips/${trip.id}/participants/${participantId}/login-link`,
      { method: "POST", headers: { Cookie: cookie } },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "email_delivery_failed" });
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
    const managerSession = await app.request(managerLink as string);
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
    const travelerSession = await app.request(travelerLink as string);
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
    const login = await app.request(sendEmail.mock.calls.at(-1)?.[1] as string);
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
    const verificationResponse = await app.request(magicLink.href);
    expect(verificationResponse.status).toBe(302);
    const cookie = verificationResponse.headers
      .get("set-cookie")
      ?.split(";")[0];
    expect(cookie).toBeTruthy();
    expect(await services.database.select().from(schema.sessions)).toHaveLength(
      1,
    );

    await app.request(magicLink.href);
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

  it("limits each email address to one magic-link request every 30 seconds", async () => {
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
    expect(retryAfter).toBeLessThanOrEqual(30);
  });
});
