import { createHash, randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { Hono } from "hono";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { AuthServices } from "./auth";
import { createAuthServicesProvider, isTrustedAuthOrigin } from "./auth";
import { createTicketBlobPath } from "./blob-path";
import { createDatabaseProvider } from "./database";
import { normalizeEmail } from "./email";
import { createRoomingStore, RoomingError, type RoomMove } from "./rooming";
import * as schema from "./schema";
import type {
  AgencyRoomingRow,
  DetailedOrderRow,
  ImportError,
  StaffImportRow,
  ValidatedRosterRow,
} from "./source-import";
import {
  loadBoundedWorkbook,
  parseAgencyRooming,
  parseCompanionsAndVips,
  parseDetailedOrders,
  parseValidatedRoster,
} from "./source-import";
import {
  DuplicateNormalizedEmailError,
  getImportBaselineHash,
  InvalidAgencyRoomingMatchError,
  InvalidStaffAccountMappingError,
  importAgencyRooming,
  importDetailedOrders,
  importStaffRows,
  importValidatedRoster,
  previewAgencyRooming,
  previewDetailedOrders,
  previewStaffImport,
  previewValidatedRoster,
} from "./source-imports";

const magicLinkEmailCooldownMs = 30_000;

export type TicketBlobStorage = {
  put: (
    pathname: string,
    file: File,
    options: {
      access: "private";
      contentType: string;
      addRandomSuffix: false;
    },
  ) => Promise<unknown>;
  get: (
    pathname: string,
    options: { access: "private" },
  ) => Promise<{
    statusCode: number;
    stream: ReadableStream<Uint8Array> | null;
  } | null>;
  del: (pathname: string) => Promise<void>;
};

const vercelTicketStorage: TicketBlobStorage = { put, get, del };

export function createApp(
  getDatabase = createDatabaseProvider(),
  getAuthServices = createAuthServicesProvider(),
  options: {
    ticketStorage?: TicketBlobStorage;
    ticketStorageAvailable?: () => boolean;
    authEnvironment?: NodeJS.ProcessEnv;
  } = {},
) {
  const app = new Hono();
  const authEnvironment = options.authEnvironment ?? process.env;
  const ticketStorage = options.ticketStorage ?? vercelTicketStorage;
  const ticketStorageAvailable =
    options.ticketStorageAvailable ??
    (() => Boolean(process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN));

  // Liveness only: this endpoint does not certify database or email readiness.
  app.get("/api/health", (context) => {
    context.header("Cache-Control", "no-store");
    return context.json({ status: "ok" });
  });

  app.get("/api/ready", async (context) => {
    context.header("Cache-Control", "no-store");
    const database = getDatabase();

    if (!database) {
      return context.json({ status: "not_ready" }, 503);
    }

    try {
      await database.execute("SELECT 1");
      return context.json({ status: "ready" });
    } catch {
      return context.json({ status: "not_ready" }, 503);
    }
  });

  app.all("/api/auth/*", async (context) => {
    const services = getAuthServices();
    if (!services) {
      context.header("Cache-Control", "no-store");
      return context.json({ error: "service_unavailable" }, 503);
    }
    if (
      context.req.method === "POST" &&
      context.req.path === "/api/auth/sign-in/magic-link"
    ) {
      return handleMagicLinkRequest(services, context.req.raw);
    }
    return services.auth.handler(context.req.raw);
  });

  app.get("/api/me", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);

    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const memberships = await services.database
      .select({
        tripId: schema.trips.id,
        tripName: schema.trips.name,
        role: schema.tripMemberships.role,
      })
      .from(schema.tripMemberships)
      .innerJoin(
        schema.trips,
        eq(schema.tripMemberships.tripId, schema.trips.id),
      )
      .where(eq(schema.tripMemberships.userId, session.user.id))
      .orderBy(schema.trips.name, schema.trips.id);

    if (memberships.length === 0) {
      return context.json({ error: "forbidden" }, 403);
    }

    return context.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      trips: memberships,
    });
  });

  app.get("/api/trips/:tripId/traveler", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const tripId = context.req.param("tripId");
    const [membership] = await services.database
      .select({
        tripId: schema.trips.id,
        tripName: schema.trips.name,
        userId: schema.tripMemberships.userId,
        firstName: schema.tripMemberships.firstName,
        lastName: schema.tripMemberships.lastName,
        gender: schema.tripMemberships.gender,
        genderConfirmed: schema.tripMemberships.genderConfirmed,
        role: schema.tripMemberships.role,
        profileFirstName: schema.travelerProfiles.firstName,
        profileLastName: schema.travelerProfiles.lastName,
        dietaryRequirements: schema.travelerProfiles.dietaryRequirements,
        allergens: schema.travelerProfiles.allergens,
        emergencyContactFirstName:
          schema.travelerProfiles.emergencyContactFirstName,
        emergencyContactLastName:
          schema.travelerProfiles.emergencyContactLastName,
        emergencyContactPhone: schema.travelerProfiles.emergencyContactPhone,
        profileCompletedAt: schema.travelerProfiles.completedAt,
      })
      .from(schema.tripMemberships)
      .innerJoin(
        schema.trips,
        eq(schema.tripMemberships.tripId, schema.trips.id),
      )
      .leftJoin(
        schema.travelerProfiles,
        and(
          eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
          eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
        ),
      )
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership) return context.json({ error: "not_found" }, 404);

    const [details] = await services.database
      .select({
        activityProfile: schema.travelerDetails.activityProfile,
        skiDayThree: schema.travelerDetails.skiDayThree,
        transportMode: schema.travelerDetails.transportMode,
        departureCity: schema.travelerDetails.departureCity,
        outboundDateTime: schema.travelerDetails.outboundDateTime,
        outboundTimezone: schema.travelerDetails.outboundTimezone,
        outboundMeetingTime: schema.travelerDetails.outboundMeetingTime,
        outboundDepartureTime: schema.travelerDetails.outboundDepartureTime,
        outboundLocation: schema.travelerDetails.outboundLocation,
        outboundReference: schema.travelerDetails.outboundReference,
        outboundSeat: schema.travelerDetails.outboundSeat,
        returnDateTime: schema.travelerDetails.returnDateTime,
        returnTimezone: schema.travelerDetails.returnTimezone,
        returnMeetingTime: schema.travelerDetails.returnMeetingTime,
        returnDepartureTime: schema.travelerDetails.returnDepartureTime,
        returnLocation: schema.travelerDetails.returnLocation,
        returnReference: schema.travelerDetails.returnReference,
        returnSeat: schema.travelerDetails.returnSeat,
        carpoolPreference: schema.travelerDetails.carpoolPreference,
        parkingPreference: schema.travelerDetails.parkingPreference,
        updatedAt: schema.travelerDetails.updatedAt,
      })
      .from(schema.travelerDetails)
      .where(
        and(
          eq(schema.travelerDetails.tripId, tripId),
          eq(schema.travelerDetails.userId, session.user.id),
        ),
      )
      .limit(1);
    const tickets = await services.database
      .select({
        id: schema.transportTickets.id,
        kind: schema.transportTickets.kind,
        originalName: schema.transportTickets.originalName,
        size: schema.transportTickets.size,
        createdAt: schema.transportTickets.createdAt,
      })
      .from(schema.transportTickets)
      .where(
        and(
          eq(schema.transportTickets.tripId, tripId),
          eq(schema.transportTickets.userId, session.user.id),
        ),
      )
      .orderBy(schema.transportTickets.createdAt);

    return context.json({
      trip: { id: membership.tripId, name: membership.tripName },
      traveler: {
        firstName: membership.profileFirstName ?? membership.firstName,
        lastName: membership.profileLastName ?? membership.lastName,
        gender: membership.gender,
        genderConfirmed: membership.genderConfirmed,
        role: membership.role,
      },
      profile: {
        dietaryRequirements: membership.dietaryRequirements,
        allergens: membership.allergens,
        emergencyContactFirstName: membership.emergencyContactFirstName,
        emergencyContactLastName: membership.emergencyContactLastName,
        emergencyContactPhone: membership.emergencyContactPhone,
        completed:
          membership.genderConfirmed && Boolean(membership.profileCompletedAt),
      },
      details: details ?? null,
      tickets,
    });
  });

  app.put("/api/trips/:tripId/profile", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [membership] = await services.database
      .select({
        gender: schema.tripMemberships.gender,
        roomId: schema.roomAssignments.roomId,
      })
      .from(schema.tripMemberships)
      .leftJoin(
        schema.roomAssignments,
        and(
          eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
          eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
        ),
      )
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership) return context.json({ error: "not_found" }, 404);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_profile" }, 400);
    }
    const input =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const firstName =
      typeof input.firstName === "string" ? input.firstName.trim() : "";
    const lastName =
      typeof input.lastName === "string" ? input.lastName.trim() : "";
    const gender = input.gender;
    const dietaryRequirements =
      typeof input.dietaryRequirements === "string"
        ? input.dietaryRequirements.trim()
        : "";
    const allergens =
      typeof input.allergens === "string" ? input.allergens.trim() : "";
    const emergencyContactFirstName =
      typeof input.emergencyContactFirstName === "string"
        ? input.emergencyContactFirstName.trim()
        : "";
    const emergencyContactLastName =
      typeof input.emergencyContactLastName === "string"
        ? input.emergencyContactLastName.trim()
        : "";
    const emergencyContactPhone =
      typeof input.emergencyContactPhone === "string"
        ? input.emergencyContactPhone.trim()
        : "";
    const parsedPhone = parsePhoneNumberFromString(emergencyContactPhone);
    if (
      firstName.length < 1 ||
      firstName.length > 100 ||
      lastName.length < 1 ||
      lastName.length > 100 ||
      (gender !== "M" && gender !== "F") ||
      dietaryRequirements.length > 500 ||
      allergens.length > 500 ||
      emergencyContactFirstName.length < 1 ||
      emergencyContactFirstName.length > 100 ||
      emergencyContactLastName.length < 1 ||
      emergencyContactLastName.length > 100 ||
      emergencyContactPhone.length > 40 ||
      !parsedPhone?.isValid()
    ) {
      return context.json({ error: "invalid_profile" }, 400);
    }
    const normalizedEmergencyContactPhone = parsedPhone.number;
    if (membership.roomId && membership.gender !== gender) {
      return context.json({ error: "gender_change_requires_room_review" }, 409);
    }
    const now = new Date();
    await services.database.transaction(async (transaction) => {
      await transaction
        .update(schema.tripMemberships)
        .set({ gender, genderConfirmed: true })
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, session.user.id),
          ),
        );
      await transaction
        .insert(schema.travelerProfiles)
        .values({
          tripId,
          userId: session.user.id,
          firstName,
          lastName,
          dietaryRequirements,
          allergens,
          emergencyContactFirstName,
          emergencyContactLastName,
          emergencyContactPhone: normalizedEmergencyContactPhone,
          completedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            schema.travelerProfiles.tripId,
            schema.travelerProfiles.userId,
          ],
          set: {
            firstName,
            lastName,
            dietaryRequirements,
            allergens,
            emergencyContactFirstName,
            emergencyContactLastName,
            emergencyContactPhone: normalizedEmergencyContactPhone,
            completedAt: now,
            updatedAt: now,
          },
        });
    });
    return context.json({ status: "saved" });
  });

  app.put("/api/trips/:tripId", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_trip" }, 400);
    }
    const name =
      body && typeof body === "object"
        ? (body as Record<string, unknown>).name
        : undefined;
    if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
      return context.json({ error: "invalid_trip_name" }, 400);
    }
    await services.database
      .update(schema.trips)
      .set({ name: name.trim() })
      .where(eq(schema.trips.id, tripId));
    return context.json({ status: "saved", name: name.trim() });
  });

  app.post("/api/trips/:tripId/companions", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_companion" }, 400);
    }
    const input =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const email =
      typeof input.email === "string" ? normalizeEmail(input.email) : "";
    const firstName =
      typeof input.firstName === "string" ? input.firstName.trim() : "";
    const lastName =
      typeof input.lastName === "string" ? input.lastName.trim() : "";
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !firstName ||
      !lastName ||
      firstName.length > 100 ||
      lastName.length > 100
    ) {
      return context.json({ error: "invalid_companion" }, 400);
    }
    try {
      const companion = await services.database.transaction(
        async (transaction) => {
          const existingUsers = await transaction
            .select({ id: schema.users.id, email: schema.users.email })
            .from(schema.users)
            .where(eq(sql<string>`lower(${schema.users.email})`, email))
            .limit(2);
          if (existingUsers.length > 1) {
            throw new Error("duplicate_normalized_email");
          }
          const existingUser = existingUsers[0];
          const userId = existingUser?.id ?? randomUUID();
          const now = new Date();
          if (!existingUser) {
            await transaction.insert(schema.users).values({
              id: userId,
              name: `${firstName} ${lastName}`,
              email,
              emailVerified: false,
              createdAt: now,
              updatedAt: now,
            });
          } else if (existingUser.email !== email) {
            await transaction
              .update(schema.users)
              .set({ email, updatedAt: now })
              .where(eq(schema.users.id, existingUser.id));
          }
          const [membership] = await transaction
            .select({
              id: schema.tripMemberships.id,
              role: schema.tripMemberships.role,
            })
            .from(schema.tripMemberships)
            .where(
              and(
                eq(schema.tripMemberships.tripId, tripId),
                eq(schema.tripMemberships.userId, userId),
              ),
            )
            .limit(1);
          if (membership?.role === "manager")
            throw new Error("cannot_change_manager_role");
          if (membership) {
            await transaction
              .update(schema.tripMemberships)
              .set({ role: "companion", firstName, lastName })
              .where(eq(schema.tripMemberships.id, membership.id));
          } else {
            await transaction.insert(schema.tripMemberships).values({
              id: randomUUID(),
              tripId,
              userId,
              role: "companion",
              firstName,
              lastName,
              gender: null,
            });
          }
          return { email, firstName, lastName };
        },
      );
      return context.json({ status: "appointed", companion }, 201);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "cannot_change_manager_role"
      ) {
        return context.json({ error: "manager_role_is_protected" }, 409);
      }
      if (
        error instanceof Error &&
        error.message === "duplicate_normalized_email"
      ) {
        return context.json({ error: "duplicate_email_accounts" }, 409);
      }
      return context.json({ error: "companion_appointment_failed" }, 503);
    }
  });

  app.post("/api/trips/:tripId/participants", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_participant" }, 400);
    }
    const input =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const email =
      typeof input.email === "string" ? normalizeEmail(input.email) : "";
    const firstName =
      typeof input.firstName === "string" ? input.firstName.trim() : "";
    const lastName =
      typeof input.lastName === "string" ? input.lastName.trim() : "";
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 320 ||
      !firstName ||
      !lastName ||
      firstName.length > 100 ||
      lastName.length > 100
    ) {
      return context.json({ error: "invalid_participant" }, 400);
    }
    try {
      const participant = await services.database.transaction(
        async (transaction) => {
          const existingUsers = await transaction
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(sql<string>`lower(${schema.users.email})`, email))
            .limit(2);
          if (existingUsers.length > 1)
            throw new Error("duplicate_normalized_email");
          const existingUser = existingUsers[0];
          const userId = existingUser?.id ?? randomUUID();
          const [existingMembership] = await transaction
            .select({ id: schema.tripMemberships.id })
            .from(schema.tripMemberships)
            .where(
              and(
                eq(schema.tripMemberships.tripId, tripId),
                eq(schema.tripMemberships.userId, userId),
              ),
            )
            .limit(1);
          if (existingMembership) throw new Error("participant_already_exists");
          if (!existingUser) {
            const now = new Date();
            await transaction.insert(schema.users).values({
              id: userId,
              name: `${firstName} ${lastName}`,
              email,
              emailVerified: false,
              createdAt: now,
              updatedAt: now,
            });
          }
          await transaction.insert(schema.tripMemberships).values({
            id: randomUUID(),
            tripId,
            userId,
            role: "traveler",
            firstName,
            lastName,
            gender: null,
          });
          return { userId, firstName, lastName, email, role: "traveler" };
        },
      );
      return context.json({ status: "created", participant }, 201);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "participant_already_exists"
      )
        return context.json({ error: "participant_already_exists" }, 409);
      if (
        error instanceof Error &&
        error.message === "duplicate_normalized_email"
      )
        return context.json({ error: "duplicate_email_accounts" }, 409);
      return context.json({ error: "participant_creation_failed" }, 503);
    }
  });

  app.get("/api/trips/:tripId/rooms", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);

    const memberships = await services.database
      .select({
        userId: schema.tripMemberships.userId,
        firstName: sql<string>`coalesce(${schema.travelerProfiles.firstName}, ${schema.tripMemberships.firstName})`,
        lastName: sql<string>`coalesce(${schema.travelerProfiles.lastName}, ${schema.tripMemberships.lastName})`,
        gender: schema.tripMemberships.gender,
      })
      .from(schema.tripMemberships)
      .leftJoin(
        schema.travelerProfiles,
        and(
          eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
          eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
        ),
      )
      .where(eq(schema.tripMemberships.tripId, tripId));
    const assignments = await services.database
      .select({
        roomId: schema.roomAssignments.roomId,
        userId: schema.roomAssignments.userId,
      })
      .from(schema.roomAssignments)
      .where(eq(schema.roomAssignments.tripId, tripId));
    const ownRoomIds = assignments
      .filter((assignment) => assignment.userId === session.user.id)
      .map((assignment) => assignment.roomId);
    const visibleRoomIds = actor.role === "traveler" ? ownRoomIds : undefined;
    const rooms = await services.database
      .select({
        id: schema.rooms.id,
        name: schema.rooms.name,
        capacity: schema.rooms.capacity,
        genderPolicy: schema.rooms.genderPolicy,
      })
      .from(schema.rooms)
      .where(eq(schema.rooms.tripId, tripId))
      .orderBy(schema.rooms.name);
    const memberById = new Map(
      memberships.map((member) => [member.userId, member]),
    );
    return context.json({
      rooms: rooms.map((room) => ({
        ...room,
        occupiedCount: assignments.filter(
          (assignment) => assignment.roomId === room.id,
        ).length,
        occupants:
          actor.role !== "traveler" || visibleRoomIds?.includes(room.id)
            ? assignments
                .filter((assignment) => assignment.roomId === room.id)
                .map((assignment) => memberById.get(assignment.userId))
                .filter((member): member is NonNullable<typeof member> =>
                  Boolean(member),
                )
            : [],
      })),
      unassignedCount:
        actor.role === "traveler"
          ? undefined
          : memberships.length - assignments.length,
    });
  });

  app.get("/api/trips/:tripId/rooms/export", async (context) => {
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role === "traveler")
      return context.json({ error: "forbidden" }, 403);

    const rooms = await services.database
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.tripId, tripId))
      .orderBy(schema.rooms.name, schema.rooms.id);
    const occupants = await services.database
      .select({
        roomId: schema.roomAssignments.roomId,
        firstName: sql<string>`coalesce(${schema.travelerProfiles.firstName}, ${schema.tripMemberships.firstName})`,
        lastName: sql<string>`coalesce(${schema.travelerProfiles.lastName}, ${schema.tripMemberships.lastName})`,
        gender: schema.tripMemberships.gender,
        email: schema.users.email,
      })
      .from(schema.roomAssignments)
      .innerJoin(
        schema.tripMemberships,
        and(
          eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
          eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
        ),
      )
      .innerJoin(
        schema.users,
        eq(schema.tripMemberships.userId, schema.users.id),
      )
      .leftJoin(
        schema.travelerProfiles,
        and(
          eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
          eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
        ),
      )
      .where(eq(schema.roomAssignments.tripId, tripId))
      .orderBy(
        schema.tripMemberships.lastName,
        schema.tripMemberships.firstName,
        schema.users.email,
      );
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Rooming");
    sheet.addRow([
      "Chambre",
      "Capacité",
      "Statut",
      "Nom",
      "Prénom",
      "Genre",
      "E-mail",
    ]);
    sheet.getRow(1).font = { bold: true };
    for (const room of rooms) {
      const people = occupants.filter(
        (occupant) => occupant.roomId === room.id,
      );
      const status =
        room.genderPolicy === "mixed"
          ? "Mixte validée"
          : room.genderPolicy === "unset"
            ? "À définir"
            : "Non-mixte";
      if (people.length === 0) {
        sheet.addRow([room.name, room.capacity, status, "", "", "", ""]);
      } else {
        people.forEach((person, index) => {
          sheet.addRow([
            index === 0 ? room.name : "",
            index === 0 ? room.capacity : "",
            index === 0 ? status : "",
            person.lastName,
            person.firstName,
            person.gender ?? "",
            person.email,
          ]);
        });
      }
    }
    sheet.columns = [
      { width: 24 },
      { width: 12 },
      { width: 18 },
      { width: 24 },
      { width: 24 },
      { width: 12 },
      { width: 38 },
    ];
    const data = await workbook.xlsx.writeBuffer();
    context.header("Cache-Control", "private, no-store");
    context.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    context.header(
      "Content-Disposition",
      "attachment; filename=traveler-rooming.xlsx",
    );
    return context.body(new Uint8Array(data));
  });

  app.post("/api/trips/:tripId/rooms/agency-export", async (context) => {
    context.header("Cache-Control", "private, no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role === "traveler")
      return context.json({ error: "forbidden" }, 403);
    let form: FormData;
    try {
      form = await context.req.formData();
    } catch {
      return context.json({ error: "invalid_rooming_template" }, 400);
    }
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx"))
      return context.json({ error: "xlsx_file_required" }, 400);
    if (file.size < 1 || file.size > 4 * 1024 * 1024)
      return context.json({ error: "import_file_size_not_allowed" }, 413);
    const parsedWorkbook = await loadBoundedWorkbook(await file.arrayBuffer());
    if (!parsedWorkbook.ok)
      return context.json({ errors: parsedWorkbook.errors }, 422);
    const workbook = parsedWorkbook.value;
    const sheet = workbook.getWorksheet("SKI TRAIN HOTEL");
    if (!sheet)
      return context.json({ error: "agency_rooming_sheet_missing" }, 422);
    const columns = agencyRoomingColumns(sheet);
    const required = [
      "Nbre de pax",
      "NOMS",
      "Prénoms",
      "Catégorie",
      "Typologie de chambre",
      "N° de chambre",
      "non skieur (pas de forfait)",
      "LIEU DEPART TRAIN",
      "Régimes spéciaux",
      "Allergènes",
      "Téléphone",
      "Commentaires",
    ];
    if (required.some((name) => !columns.has(normalizeSheetHeader(name))))
      return context.json({ error: "agency_rooming_headers_missing" }, 422);
    const roomColumn = columns.get(
      normalizeSheetHeader("Typologie de chambre"),
    );
    const numberColumn = columns.get(normalizeSheetHeader("N° de chambre"));
    if (roomColumn === undefined || numberColumn === undefined)
      return context.json({ error: "agency_rooming_headers_missing" }, 422);
    const roomRows = new Map<
      string,
      { name: string; capacity: number; rows: number[] }
    >();
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const type = row.getCell(roomColumn).text.trim();
      const number = row.getCell(numberColumn).text.trim();
      if (!type || !number) return;
      const capacity = roomCapacity(type);
      if (!capacity) return;
      const name = `${type.toUpperCase()} ${number}`;
      const room = roomRows.get(name) ?? { name, capacity, rows: [] };
      room.rows.push(rowNumber);
      roomRows.set(name, room);
    });
    const inventory = [...roomRows.values()];
    if (
      !inventory.length ||
      inventory.length > 100 ||
      inventory.reduce((total, room) => total + room.rows.length, 0) > 500
    )
      return context.json({ error: "agency_room_inventory_missing" }, 422);
    const existingRooms = await services.database
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.tripId, tripId));
    if (!existingRooms.length) {
      for (const room of inventory) {
        await services.database.insert(schema.rooms).values({
          id: randomUUID(),
          tripId,
          name: room.name,
          capacity: room.capacity,
          genderPolicy: "unset",
          compositionVersion: 1,
        });
      }
    }
    const rooms = existingRooms.length
      ? existingRooms
      : await services.database
          .select()
          .from(schema.rooms)
          .where(eq(schema.rooms.tripId, tripId));
    const roomByName = new Map(
      rooms.map((room) => [room.name.toUpperCase(), room]),
    );
    if (
      inventory.some(
        (room) =>
          roomByName.get(room.name.toUpperCase())?.capacity !== room.capacity,
      ) ||
      rooms.length !== inventory.length
    )
      return context.json({ error: "agency_room_inventory_mismatch" }, 409);
    const members = await services.database
      .select({
        userId: schema.tripMemberships.userId,
        role: schema.tripMemberships.role,
        isVip: schema.tripMemberships.isVip,
        firstName: sql<string>`coalesce(${schema.travelerProfiles.firstName}, ${schema.tripMemberships.firstName})`,
        lastName: sql<string>`coalesce(${schema.travelerProfiles.lastName}, ${schema.tripMemberships.lastName})`,
        roomId: schema.roomAssignments.roomId,
        activityProfile: schema.travelerDetails.activityProfile,
        skiDayThree: schema.travelerDetails.skiDayThree,
        departureCity: schema.travelerDetails.departureCity,
        dietaryRequirements: schema.travelerProfiles.dietaryRequirements,
        allergens: schema.travelerProfiles.allergens,
      })
      .from(schema.tripMemberships)
      .leftJoin(
        schema.travelerProfiles,
        and(
          eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
          eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
        ),
      )
      .leftJoin(
        schema.travelerDetails,
        and(
          eq(schema.travelerDetails.tripId, schema.tripMemberships.tripId),
          eq(schema.travelerDetails.userId, schema.tripMemberships.userId),
        ),
      )
      .leftJoin(
        schema.roomAssignments,
        and(
          eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
          eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
        ),
      )
      .where(eq(schema.tripMemberships.tripId, tripId));
    const phones = await services.database
      .select({
        userId: schema.tripRegistrations.userId,
        sourcePhone: schema.tripRegistrations.sourcePhone,
      })
      .from(schema.tripRegistrations)
      .where(
        and(
          eq(schema.tripRegistrations.tripId, tripId),
          eq(schema.tripRegistrations.status, "validated"),
        ),
      );
    const phoneByUser = new Map<string, string>();
    for (const item of phones)
      if (item.userId && item.sourcePhone && !phoneByUser.has(item.userId))
        phoneByUser.set(item.userId, item.sourcePhone);
    const assignedByRoom = new Map<string, typeof members>();
    for (const member of members) {
      if (!member.roomId) continue;
      assignedByRoom.set(member.roomId, [
        ...(assignedByRoom.get(member.roomId) ?? []),
        member,
      ]);
    }
    for (const room of inventory) {
      const dbRoom = roomByName.get(room.name.toUpperCase());
      const occupants = dbRoom ? (assignedByRoom.get(dbRoom.id) ?? []) : [];
      if (
        occupants.length > room.rows.length ||
        room.rows.length < room.capacity
      )
        return context.json({ error: "agency_room_capacity_mismatch" }, 409);
      for (const rowNumber of room.rows) {
        const row = sheet.getRow(rowNumber);
        for (const field of [
          "Nbre de pax",
          "NOMS",
          "Prénoms",
          "Catégorie",
          "non skieur (pas de forfait)",
          "LIEU DEPART TRAIN",
          "Régimes spéciaux",
          "Allergènes",
          "Téléphone",
        ])
          setAgencyCell(row, columns, field, "");
      }
      const firstRoomRow = room.rows[0];
      if (firstRoomRow !== undefined) {
        setAgencyCell(
          sheet.getRow(firstRoomRow),
          columns,
          "Nbre de pax",
          String(occupants.length),
        );
      }
      occupants.forEach((person, index) => {
        const rowNumber = room.rows[index];
        if (rowNumber === undefined) return;
        const row = sheet.getRow(rowNumber);
        setAgencyCell(row, columns, "NOMS", person.lastName);
        setAgencyCell(row, columns, "Prénoms", person.firstName);
        setAgencyCell(
          row,
          columns,
          "Catégorie",
          person.isVip
            ? "VIP"
            : person.role === "companion"
              ? "Accompagnateur"
              : (person.activityProfile ?? "").toUpperCase(),
        );
        setAgencyCell(
          row,
          columns,
          "non skieur (pas de forfait)",
          person.activityProfile === "spa" ? "Oui" : "Non",
        );
        setAgencyCell(
          row,
          columns,
          "LIEU DEPART TRAIN",
          person.departureCity ?? "Sans",
        );
        setAgencyCell(
          row,
          columns,
          "Régimes spéciaux",
          person.dietaryRequirements ?? "",
        );
        setAgencyCell(row, columns, "Allergènes", person.allergens ?? "");
        setAgencyCell(
          row,
          columns,
          "Téléphone",
          phoneByUser.get(person.userId) ?? "",
        );
        const commentsColumn = columns.get(
          normalizeSheetHeader("Commentaires"),
        );
        const currentComments = commentsColumn
          ? row.getCell(commentsColumn).text.trim()
          : "";
        if (
          person.skiDayThree &&
          !currentComments.toLocaleLowerCase("fr").includes("3e jour de ski")
        ) {
          setAgencyCell(
            row,
            columns,
            "Commentaires",
            [currentComments, "3e jour de ski"].filter(Boolean).join(" · "),
          );
        }
      });
    }
    const result = await workbook.xlsx.writeBuffer();
    context.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    context.header(
      "Content-Disposition",
      "attachment; filename=traveler-rooming-agence.xlsx",
    );
    return context.body(new Uint8Array(result));
  });

  app.post("/api/trips/:tripId/rooms", async (context) => {
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role === "traveler")
      return context.json({ error: "forbidden" }, 403);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_room" }, 400);
    }
    if (!body || typeof body !== "object")
      return context.json({ error: "invalid_room" }, 400);
    const { name, capacity } = body as Record<string, unknown>;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 80 ||
      !Number.isInteger(capacity) ||
      (capacity as number) < 1 ||
      (capacity as number) > 12
    ) {
      return context.json({ error: "invalid_room" }, 400);
    }
    const existingNames = await services.database
      .select({ name: schema.rooms.name })
      .from(schema.rooms)
      .where(eq(schema.rooms.tripId, tripId));
    if (
      existingNames.some(
        (room) =>
          room.name.trim().toLocaleLowerCase("fr-FR") ===
          name.trim().toLocaleLowerCase("fr-FR"),
      )
    ) {
      return context.json({ error: "room_name_already_exists" }, 409);
    }
    try {
      const [room] = await services.database
        .insert(schema.rooms)
        .values({
          id: randomUUID(),
          tripId,
          name: name.trim(),
          capacity: capacity as number,
        })
        .returning({
          id: schema.rooms.id,
          name: schema.rooms.name,
          capacity: schema.rooms.capacity,
        });
      return context.json({ room }, 201);
    } catch {
      return context.json({ error: "room_name_already_exists" }, 409);
    }
  });

  app.post(
    "/api/trips/:tripId/rooms/:roomId/initial-assignment",
    async (context) => {
      const services = getAuthServices();
      if (!services) return context.json({ error: "service_unavailable" }, 503);
      const session = await getSession(services, context.req.raw.headers);
      if (!session) return context.json({ error: "unauthorized" }, 401);
      const tripId = context.req.param("tripId");
      const roomId = context.req.param("roomId");
      const [actor] = await services.database
        .select({ role: schema.tripMemberships.role })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, session.user.id),
          ),
        )
        .limit(1);
      if (!actor) return context.json({ error: "not_found" }, 404);
      if (actor.role === "traveler")
        return context.json({ error: "forbidden" }, 403);
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "invalid_assignment" }, 400);
      }
      const userId =
        body && typeof body === "object"
          ? (body as Record<string, unknown>).userId
          : undefined;
      if (typeof userId !== "string" || !userId)
        return context.json({ error: "invalid_assignment" }, 400);
      const result = await services.database.transaction(
        async (transaction) => {
          const [target] = await transaction
            .select({
              userId: schema.tripMemberships.userId,
              gender: schema.tripMemberships.gender,
            })
            .from(schema.tripMemberships)
            .where(
              and(
                eq(schema.tripMemberships.tripId, tripId),
                eq(schema.tripMemberships.userId, userId),
              ),
            )
            .limit(1);
          const [room] = await transaction
            .select()
            .from(schema.rooms)
            .where(
              and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)),
            )
            .limit(1);
          if (!target || !room) return { error: "not_found" as const };
          const [existing] = await transaction
            .select({ roomId: schema.roomAssignments.roomId })
            .from(schema.roomAssignments)
            .where(
              and(
                eq(schema.roomAssignments.tripId, tripId),
                eq(schema.roomAssignments.userId, userId),
              ),
            )
            .limit(1);
          if (existing)
            return {
              error:
                existing.roomId === roomId
                  ? ("already_assigned" as const)
                  : ("room_change_requires_consents" as const),
            };
          const occupants = await transaction
            .select({ gender: schema.tripMemberships.gender })
            .from(schema.roomAssignments)
            .innerJoin(
              schema.tripMemberships,
              and(
                eq(
                  schema.roomAssignments.tripId,
                  schema.tripMemberships.tripId,
                ),
                eq(
                  schema.roomAssignments.userId,
                  schema.tripMemberships.userId,
                ),
              ),
            )
            .where(
              and(
                eq(schema.roomAssignments.tripId, tripId),
                eq(schema.roomAssignments.roomId, roomId),
              ),
            );
          if (occupants.length >= room.capacity)
            return { error: "room_capacity_exceeded" as const };
          const currentGenders = new Set(
            occupants
              .map((occupant) => occupant.gender)
              .filter((gender): gender is "M" | "F" => gender !== null),
          );
          if (
            room.genderPolicy === "mixed" ||
            (target.gender &&
              currentGenders.size > 0 &&
              !currentGenders.has(target.gender))
          ) {
            return { error: "room_change_requires_consents" as const };
          }
          await transaction
            .insert(schema.roomAssignments)
            .values({ id: randomUUID(), tripId, roomId, userId });
          const genders = new Set(
            [
              ...occupants.map((occupant) => occupant.gender),
              target.gender,
            ].filter((gender): gender is "M" | "F" => gender !== null),
          );
          await transaction
            .update(schema.rooms)
            .set({
              compositionVersion: sql`${schema.rooms.compositionVersion} + 1`,
              genderPolicy:
                genders.size === 0
                  ? "unset"
                  : genders.size > 1
                    ? "mixed"
                    : "single_gender",
            })
            .where(
              and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)),
            );
          return { error: null };
        },
      );
      if (result.error === "not_found")
        return context.json({ error: result.error }, 404);
      if (result.error === "room_change_requires_consents")
        return context.json({ error: result.error }, 409);
      if (result.error === "room_capacity_exceeded")
        return context.json({ error: result.error }, 409);
      if (result.error === "already_assigned")
        return context.json({ status: "already_assigned" });
      return context.json({ status: "assigned" }, 201);
    },
  );

  app.post("/api/trips/:tripId/room-requests", async (context) => {
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [membership] = await services.database
      .select({ id: schema.tripMemberships.id })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership) return context.json({ error: "not_found" }, 404);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_room_change" }, 400);
    }
    const requestBody =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : undefined;
    let moves = requestBody?.moves;
    const targetRoomId = requestBody?.targetRoomId;
    const exchangeWithEmail = requestBody?.exchangeWithEmail;
    if (
      typeof targetRoomId === "string" &&
      typeof exchangeWithEmail === "string" &&
      exchangeWithEmail.trim()
    ) {
      const [requesterAssignment] = await services.database
        .select({ roomId: schema.roomAssignments.roomId })
        .from(schema.roomAssignments)
        .where(
          and(
            eq(schema.roomAssignments.tripId, tripId),
            eq(schema.roomAssignments.userId, session.user.id),
          ),
        )
        .limit(1);
      const [exchangePerson] = await services.database
        .select({
          userId: schema.tripMemberships.userId,
          roomId: schema.roomAssignments.roomId,
        })
        .from(schema.tripMemberships)
        .innerJoin(
          schema.users,
          eq(schema.tripMemberships.userId, schema.users.id),
        )
        .innerJoin(
          schema.roomAssignments,
          and(
            eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
            eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
          ),
        )
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.roomAssignments.roomId, targetRoomId),
            eq(
              sql<string>`lower(${schema.users.email})`,
              normalizeEmail(exchangeWithEmail),
            ),
          ),
        )
        .limit(1);
      if (
        !requesterAssignment ||
        !exchangePerson ||
        exchangePerson.userId === session.user.id
      ) {
        return context.json({ error: "invalid_room_exchange" }, 409);
      }
      moves = [
        {
          userId: session.user.id,
          expectedRoomId: requesterAssignment.roomId,
          targetRoomId,
        },
        {
          userId: exchangePerson.userId,
          expectedRoomId: targetRoomId,
          targetRoomId: requesterAssignment.roomId,
        },
      ];
    }
    if (
      !Array.isArray(moves) ||
      moves.some(
        (move) =>
          !move ||
          typeof move !== "object" ||
          typeof move.userId !== "string" ||
          !(
            typeof move.expectedRoomId === "string" ||
            move.expectedRoomId === null
          ) ||
          typeof move.targetRoomId !== "string",
      )
    ) {
      return context.json({ error: "invalid_room_change" }, 400);
    }
    try {
      const request = await createRoomingStore(services.database).createRequest(
        tripId,
        session.user.id,
        moves as {
          userId: string;
          expectedRoomId: string | null;
          targetRoomId: string;
        }[],
      );
      return context.json({ request }, 201);
    } catch (error) {
      if (error instanceof RoomingError)
        return context.json(
          { error: error.code },
          error.code === "traveler_not_in_trip" ||
            error.code === "room_not_in_trip"
            ? 404
            : 409,
        );
      return context.json({ error: "room_request_failed" }, 503);
    }
  });

  app.get("/api/trips/:tripId/room-requests", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    const records = await services.database
      .select()
      .from(schema.roomChangeRequests)
      .where(
        and(
          eq(schema.roomChangeRequests.tripId, tripId),
          eq(schema.roomChangeRequests.status, "pending"),
          ...(actor.role === "traveler"
            ? [
                sql`EXISTS (
                  SELECT 1
                  FROM json_each(${schema.roomChangeRequests.requiredConsentsJson}) AS consent
                  WHERE consent.value = ${session.user.id}
                )`,
              ]
            : []),
        ),
      )
      .orderBy(schema.roomChangeRequests.createdAt)
      .limit(100);
    const relevant = records;
    const userIds = new Set<string>();
    const roomIds = new Set<string>();
    for (const record of relevant) {
      const required = JSON.parse(record.requiredConsentsJson) as string[];
      for (const userId of required) userIds.add(userId);
      const payload = JSON.parse(record.changesJson) as {
        moves: {
          userId: string;
          expectedRoomId: string | null;
          targetRoomId: string;
        }[];
      };
      for (const move of payload.moves) {
        userIds.add(move.userId);
        if (move.expectedRoomId) roomIds.add(move.expectedRoomId);
        roomIds.add(move.targetRoomId);
      }
    }
    const people = userIds.size
      ? await services.database
          .select({
            userId: schema.tripMemberships.userId,
            firstName: schema.tripMemberships.firstName,
            lastName: schema.tripMemberships.lastName,
          })
          .from(schema.tripMemberships)
          .where(
            and(
              eq(schema.tripMemberships.tripId, tripId),
              inArray(schema.tripMemberships.userId, [...userIds]),
            ),
          )
      : [];
    const rooms = roomIds.size
      ? await services.database
          .select({ id: schema.rooms.id, name: schema.rooms.name })
          .from(schema.rooms)
          .where(
            and(
              eq(schema.rooms.tripId, tripId),
              inArray(schema.rooms.id, [...roomIds]),
            ),
          )
      : [];
    const personById = new Map(people.map((person) => [person.userId, person]));
    const roomById = new Map(rooms.map((room) => [room.id, room.name]));
    return context.json({
      requests: relevant.map((record) => {
        const requiredConsents = JSON.parse(
          record.requiredConsentsJson,
        ) as string[];
        const approvedConsents = JSON.parse(
          record.approvedConsentsJson,
        ) as string[];
        const payload = JSON.parse(record.changesJson) as { moves: RoomMove[] };
        return {
          id: record.id,
          requester: personById.get(record.requesterUserId),
          requiredConsents: requiredConsents.map((userId) => ({
            ...personById.get(userId),
            userId,
            approved: approvedConsents.includes(userId),
          })),
          moves: payload.moves.map((move) => ({
            ...move,
            person: personById.get(move.userId),
            currentRoom: move.expectedRoomId
              ? roomById.get(move.expectedRoomId)
              : null,
            targetRoom: roomById.get(move.targetRoomId),
          })),
          createdAt: record.createdAt,
        };
      }),
    });
  });

  app.post(
    "/api/trips/:tripId/room-requests/:requestId/consent",
    async (context) => {
      const services = getAuthServices();
      if (!services) return context.json({ error: "service_unavailable" }, 503);
      const session = await getSession(services, context.req.raw.headers);
      if (!session) return context.json({ error: "unauthorized" }, 401);
      const tripId = context.req.param("tripId");
      const [membership] = await services.database
        .select({ id: schema.tripMemberships.id })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, session.user.id),
          ),
        )
        .limit(1);
      if (!membership) return context.json({ error: "not_found" }, 404);
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "invalid_consent" }, 400);
      }
      const approve =
        body && typeof body === "object"
          ? (body as Record<string, unknown>).approve
          : undefined;
      if (typeof approve !== "boolean")
        return context.json({ error: "invalid_consent" }, 400);
      try {
        const result = await createRoomingStore(services.database).consent(
          tripId,
          context.req.param("requestId"),
          session.user.id,
          approve,
        );
        return context.json(result);
      } catch (error) {
        if (error instanceof RoomingError)
          return context.json(
            { error: error.code },
            error.code === "request_not_found" ? 404 : 409,
          );
        return context.json({ error: "room_consent_failed" }, 503);
      }
    },
  );

  app.put("/api/trips/:tripId/travelers/:userId/details", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const tripId = context.req.param("tripId");
    const targetUserId = context.req.param("userId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role === "traveler")
      return context.json({ error: "forbidden" }, 403);

    const [target] = await services.database
      .select({ userId: schema.tripMemberships.userId })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, targetUserId),
        ),
      )
      .limit(1);
    if (!target) return context.json({ error: "not_found" }, 404);

    const parsed = await parseTravelerDetails(context.req.raw);
    if (!parsed.ok) return context.json({ error: "invalid_details" }, 400);
    const details = synchronizeDepartureTimes(parsed.value);
    const result = validateTravelerDetails(details);
    if (result) return context.json({ error: result }, 400);

    await services.database
      .insert(schema.travelerDetails)
      .values({ tripId, userId: targetUserId, ...details })
      .onConflictDoUpdate({
        target: [schema.travelerDetails.tripId, schema.travelerDetails.userId],
        set: { ...details, updatedAt: new Date() },
      });

    return context.json({ status: "saved" });
  });

  app.patch("/api/trips/:tripId/carpool-preferences", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [membership] = await services.database
      .select({ userId: schema.tripMemberships.userId })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership) return context.json({ error: "not_found" }, 404);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_preferences" }, 400);
    }
    const input =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    if (
      typeof input.carpoolPreference !== "boolean" ||
      typeof input.parkingPreference !== "boolean"
    ) {
      return context.json({ error: "invalid_preferences" }, 400);
    }
    if (input.parkingPreference && !input.carpoolPreference) {
      return context.json({ error: "parking_requires_carpool" }, 400);
    }
    const [details] = await services.database
      .select({
        transportMode: schema.travelerDetails.transportMode,
        activityProfile: schema.travelerDetails.activityProfile,
        skiDayThree: schema.travelerDetails.skiDayThree,
      })
      .from(schema.travelerDetails)
      .where(
        and(
          eq(schema.travelerDetails.tripId, tripId),
          eq(schema.travelerDetails.userId, session.user.id),
        ),
      )
      .limit(1);
    if (details?.transportMode !== "none") {
      return context.json({ error: "carpool_requires_no_transport" }, 409);
    }
    await services.database
      .update(schema.travelerDetails)
      .set({
        carpoolPreference: input.carpoolPreference,
        parkingPreference: input.parkingPreference,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.travelerDetails.tripId, tripId),
          eq(schema.travelerDetails.userId, session.user.id),
        ),
      );
    return context.json({ status: "saved" });
  });

  app.get("/api/trips/:tripId/travelers", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role === "traveler")
      return context.json({ error: "forbidden" }, 403);

    const travelers = await services.database
      .select({
        userId: schema.tripMemberships.userId,
        firstName: sql<string>`coalesce(${schema.travelerProfiles.firstName}, ${schema.tripMemberships.firstName})`,
        lastName: sql<string>`coalesce(${schema.travelerProfiles.lastName}, ${schema.tripMemberships.lastName})`,
        gender: schema.tripMemberships.gender,
        genderConfirmed: schema.tripMemberships.genderConfirmed,
        email: schema.users.email,
        role: schema.tripMemberships.role,
        lastLoginAt: schema.tripMemberships.lastLoginAt,
        dietaryRequirements: schema.travelerProfiles.dietaryRequirements,
        allergens: schema.travelerProfiles.allergens,
        profileCompletedAt: schema.travelerProfiles.completedAt,
        emergencyContactFirstName:
          schema.travelerProfiles.emergencyContactFirstName,
        emergencyContactLastName:
          schema.travelerProfiles.emergencyContactLastName,
        emergencyContactPhone: schema.travelerProfiles.emergencyContactPhone,
        activityProfile: schema.travelerDetails.activityProfile,
        skiDayThree: schema.travelerDetails.skiDayThree,
        transportMode: schema.travelerDetails.transportMode,
        departureCity: schema.travelerDetails.departureCity,
        outboundDateTime: schema.travelerDetails.outboundDateTime,
        outboundTimezone: schema.travelerDetails.outboundTimezone,
        outboundMeetingTime: schema.travelerDetails.outboundMeetingTime,
        outboundDepartureTime: schema.travelerDetails.outboundDepartureTime,
        outboundLocation: schema.travelerDetails.outboundLocation,
        outboundReference: schema.travelerDetails.outboundReference,
        outboundSeat: schema.travelerDetails.outboundSeat,
        returnDateTime: schema.travelerDetails.returnDateTime,
        returnTimezone: schema.travelerDetails.returnTimezone,
        returnMeetingTime: schema.travelerDetails.returnMeetingTime,
        returnDepartureTime: schema.travelerDetails.returnDepartureTime,
        returnLocation: schema.travelerDetails.returnLocation,
        returnReference: schema.travelerDetails.returnReference,
        returnSeat: schema.travelerDetails.returnSeat,
        carpoolPreference: schema.travelerDetails.carpoolPreference,
        parkingPreference: schema.travelerDetails.parkingPreference,
      })
      .from(schema.tripMemberships)
      .innerJoin(
        schema.users,
        eq(schema.tripMemberships.userId, schema.users.id),
      )
      .leftJoin(
        schema.travelerDetails,
        and(
          eq(schema.tripMemberships.tripId, schema.travelerDetails.tripId),
          eq(schema.tripMemberships.userId, schema.travelerDetails.userId),
        ),
      )
      .leftJoin(
        schema.travelerProfiles,
        and(
          eq(schema.tripMemberships.tripId, schema.travelerProfiles.tripId),
          eq(schema.tripMemberships.userId, schema.travelerProfiles.userId),
        ),
      )
      .where(eq(schema.tripMemberships.tripId, tripId))
      .orderBy(
        schema.tripMemberships.lastName,
        schema.tripMemberships.firstName,
      );
    const registrations = await services.database
      .select({
        userId: schema.tripRegistrations.userId,
        paymentStatus: schema.tripRegistrations.paymentStatus,
        amountPaidMinor: schema.tripRegistrations.amountPaidMinor,
        amountDueMinor: schema.tripRegistrations.amountDueMinor,
      })
      .from(schema.tripRegistrations)
      .where(
        and(
          eq(schema.tripRegistrations.tripId, tripId),
          eq(schema.tripRegistrations.status, "validated"),
        ),
      );
    const paymentsByUser = new Map<string, (typeof registrations)[number][]>();
    for (const registration of registrations) {
      if (!registration.userId) continue;
      const items = paymentsByUser.get(registration.userId) ?? [];
      items.push(registration);
      paymentsByUser.set(registration.userId, items);
    }
    return context.json({
      travelers: travelers.map((person) => {
        const paymentItems = paymentsByUser.get(person.userId) ?? [];
        const payment = paymentItems.length === 1 ? paymentItems[0] : null;
        return {
          ...person,
          paymentStatus:
            actor.role === "manager" ? (payment?.paymentStatus ?? null) : null,
          amountPaidMinor:
            actor.role === "manager"
              ? (payment?.amountPaidMinor ?? null)
              : null,
          amountDueMinor:
            actor.role === "manager" ? (payment?.amountDueMinor ?? null) : null,
          paymentNeedsReview:
            actor.role === "manager" && paymentItems.length > 1,
        };
      }),
    });
  });

  app.get("/api/trips/:tripId/participants/access", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);
    const participants = await services.database
      .select({
        userId: schema.tripMemberships.userId,
        firstName: schema.tripMemberships.firstName,
        lastName: schema.tripMemberships.lastName,
        email: schema.users.email,
        role: schema.tripMemberships.role,
        lastLoginAt: schema.tripMemberships.lastLoginAt,
      })
      .from(schema.tripMemberships)
      .innerJoin(
        schema.users,
        eq(schema.tripMemberships.userId, schema.users.id),
      )
      .where(eq(schema.tripMemberships.tripId, tripId))
      .orderBy(
        schema.tripMemberships.lastName,
        schema.tripMemberships.firstName,
      );
    const registrations = await services.database
      .select({
        userId: schema.tripRegistrations.userId,
        paymentStatus: schema.tripRegistrations.paymentStatus,
        amountPaidMinor: schema.tripRegistrations.amountPaidMinor,
        amountDueMinor: schema.tripRegistrations.amountDueMinor,
      })
      .from(schema.tripRegistrations)
      .where(
        and(
          eq(schema.tripRegistrations.tripId, tripId),
          eq(schema.tripRegistrations.status, "validated"),
        ),
      );
    const paymentsByUser = new Map<string, (typeof registrations)[number][]>();
    for (const registration of registrations) {
      if (!registration.userId) continue;
      const items = paymentsByUser.get(registration.userId) ?? [];
      items.push(registration);
      paymentsByUser.set(registration.userId, items);
    }
    return context.json({
      participants: participants.map((participant) => {
        const paymentItems = paymentsByUser.get(participant.userId) ?? [];
        const payment = paymentItems.length === 1 ? paymentItems[0] : null;
        return {
          ...participant,
          paymentStatus: payment?.paymentStatus ?? null,
          amountPaidMinor: payment?.amountPaidMinor ?? null,
          amountDueMinor: payment?.amountDueMinor ?? null,
          paymentNeedsReview: paymentItems.length > 1,
        };
      }),
    });
  });

  app.put("/api/trips/:tripId/participants/:userId/role", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const userId = context.req.param("userId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_role" }, 400);
    }
    const role =
      body && typeof body === "object" && "role" in body
        ? (body as { role?: unknown }).role
        : undefined;
    if (role !== "traveler" && role !== "companion" && role !== "manager")
      return context.json({ error: "invalid_role" }, 400);
    if (userId === session.user.id)
      return context.json({ error: "cannot_change_own_role" }, 409);
    const [target] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, userId),
        ),
      )
      .limit(1);
    if (!target) return context.json({ error: "not_found" }, 404);
    const roleUpdate = await services.database.transaction(
      async (transaction) => {
        const [currentTarget] = await transaction
          .select({ role: schema.tripMemberships.role })
          .from(schema.tripMemberships)
          .where(
            and(
              eq(schema.tripMemberships.tripId, tripId),
              eq(schema.tripMemberships.userId, userId),
            ),
          )
          .limit(1);
        if (!currentTarget) return "not_found";
        if (currentTarget.role === "manager" && role !== "manager") {
          const managers = await transaction
            .select({ userId: schema.tripMemberships.userId })
            .from(schema.tripMemberships)
            .where(
              and(
                eq(schema.tripMemberships.tripId, tripId),
                eq(schema.tripMemberships.role, "manager"),
              ),
            );
          if (managers.length <= 1) return "last_manager_required";
        }
        await transaction
          .update(schema.tripMemberships)
          .set({ role })
          .where(
            and(
              eq(schema.tripMemberships.tripId, tripId),
              eq(schema.tripMemberships.userId, userId),
            ),
          );
        return "updated";
      },
    );
    if (roleUpdate === "not_found")
      return context.json({ error: "not_found" }, 404);
    if (roleUpdate === "last_manager_required")
      return context.json({ error: roleUpdate }, 409);
    return context.json({ status: "updated", role });
  });

  app.put(
    "/api/trips/:tripId/participants/:userId/profile",
    async (context) => {
      context.header("Cache-Control", "no-store");
      const services = getAuthServices();
      if (!services) return context.json({ error: "service_unavailable" }, 503);
      const session = await getSession(services, context.req.raw.headers);
      if (!session) return context.json({ error: "unauthorized" }, 401);
      const tripId = context.req.param("tripId");
      const userId = context.req.param("userId");
      const [actor] = await services.database
        .select({ role: schema.tripMemberships.role })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, session.user.id),
          ),
        )
        .limit(1);
      if (!actor) return context.json({ error: "not_found" }, 404);
      if (actor.role === "traveler")
        return context.json({ error: "forbidden" }, 403);
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "invalid_profile" }, 400);
      }
      const input =
        body && typeof body === "object"
          ? (body as Record<string, unknown>)
          : {};
      const firstName =
        typeof input.firstName === "string" ? input.firstName.trim() : "";
      const lastName =
        typeof input.lastName === "string" ? input.lastName.trim() : "";
      const gender = input.gender;
      const dietaryRequirements =
        typeof input.dietaryRequirements === "string"
          ? input.dietaryRequirements.trim()
          : "";
      const allergens =
        typeof input.allergens === "string" ? input.allergens.trim() : "";
      const emergencyContactFirstName =
        typeof input.emergencyContactFirstName === "string"
          ? input.emergencyContactFirstName.trim()
          : "";
      const emergencyContactLastName =
        typeof input.emergencyContactLastName === "string"
          ? input.emergencyContactLastName.trim()
          : "";
      const emergencyContactPhone =
        typeof input.emergencyContactPhone === "string"
          ? input.emergencyContactPhone.trim()
          : "";
      const parsedPhone = emergencyContactPhone
        ? parsePhoneNumberFromString(emergencyContactPhone)
        : undefined;
      if (
        firstName.length < 1 ||
        firstName.length > 100 ||
        lastName.length < 1 ||
        lastName.length > 100 ||
        (gender !== null && gender !== "M" && gender !== "F") ||
        dietaryRequirements.length > 500 ||
        allergens.length > 500 ||
        emergencyContactFirstName.length > 100 ||
        emergencyContactLastName.length > 100 ||
        emergencyContactPhone.length > 40 ||
        (emergencyContactPhone && !parsedPhone?.isValid()) ||
        emergencyContactFirstName ||
        emergencyContactLastName ||
        (emergencyContactPhone &&
          (!emergencyContactFirstName ||
            !emergencyContactLastName ||
            !parsedPhone?.isValid()))
      )
        return context.json({ error: "invalid_profile" }, 400);
      const [target] = await services.database
        .select({
          gender: schema.tripMemberships.gender,
          roomId: schema.roomAssignments.roomId,
        })
        .from(schema.tripMemberships)
        .leftJoin(
          schema.roomAssignments,
          and(
            eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
            eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
          ),
        )
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, userId),
          ),
        )
        .limit(1);
      if (!target) return context.json({ error: "not_found" }, 404);
      if (target.roomId && target.gender !== gender)
        return context.json(
          { error: "gender_change_requires_room_review" },
          409,
        );
      const now = new Date();
      const emergencyContactIsComplete = Boolean(
        emergencyContactFirstName &&
          emergencyContactLastName &&
          parsedPhone?.isValid(),
      );
      await services.database.transaction(async (transaction) => {
        await transaction
          .update(schema.tripMemberships)
          .set({
            firstName,
            lastName,
            gender,
            genderConfirmed: gender !== null,
          })
          .where(
            and(
              eq(schema.tripMemberships.tripId, tripId),
              eq(schema.tripMemberships.userId, userId),
            ),
          );
        await transaction
          .insert(schema.travelerProfiles)
          .values({
            tripId,
            userId,
            firstName,
            lastName,
            dietaryRequirements,
            allergens,
            emergencyContactFirstName,
            emergencyContactLastName,
            emergencyContactPhone: parsedPhone?.number ?? "",
            completedAt:
              gender !== null && emergencyContactIsComplete ? now : null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              schema.travelerProfiles.tripId,
              schema.travelerProfiles.userId,
            ],
            set: {
              firstName,
              lastName,
              dietaryRequirements,
              allergens,
              emergencyContactFirstName,
              emergencyContactLastName,
              emergencyContactPhone: parsedPhone?.number ?? "",
              completedAt:
                gender !== null && emergencyContactIsComplete ? now : null,
              updatedAt: now,
            },
          });
      });
      return context.json({ status: "saved" });
    },
  );

  app.put("/api/trips/:tripId/participants/:userId/email", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const targetUserId = context.req.param("userId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_email" }, 400);
    }
    const rawEmail =
      body && typeof body === "object" && "email" in body
        ? (body as { email?: unknown }).email
        : undefined;
    if (typeof rawEmail !== "string")
      return context.json({ error: "invalid_email" }, 400);
    const email = normalizeEmail(rawEmail);
    if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return context.json({ error: "invalid_email" }, 400);
    }
    const [target] = await services.database
      .select({ email: schema.users.email, role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .innerJoin(
        schema.users,
        eq(schema.tripMemberships.userId, schema.users.id),
      )
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, targetUserId),
        ),
      )
      .limit(1);
    if (!target) return context.json({ error: "not_found" }, 404);
    const oldEmail = normalizeEmail(target.email);
    if (oldEmail === email) return context.json({ status: "unchanged", email });
    const [collision] = await services.database
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          sql<string>`lower(${schema.users.email}) = ${email}`,
          sql`${schema.users.id} <> ${targetUserId}`,
        ),
      )
      .limit(1);
    if (collision) return context.json({ error: "email_in_use" }, 409);
    try {
      await services.database.transaction(async (transaction) => {
        await transaction
          .update(schema.users)
          .set({ email, emailVerified: false, updatedAt: new Date() })
          .where(eq(schema.users.id, targetUserId));
        await transaction
          .delete(schema.sessions)
          .where(eq(schema.sessions.userId, targetUserId));
        await transaction
          .delete(schema.verifications)
          .where(eq(schema.verifications.identifier, oldEmail));
      });
    } catch {
      return context.json({ error: "email_in_use" }, 409);
    }
    return context.json({ status: "updated", email });
  });

  app.post(
    "/api/trips/:tripId/participants/:userId/login-link",
    async (context) => {
      context.header("Cache-Control", "no-store");
      const services = getAuthServices();
      if (!services) return context.json({ error: "service_unavailable" }, 503);
      const session = await getSession(services, context.req.raw.headers);
      if (!session) return context.json({ error: "unauthorized" }, 401);
      const tripId = context.req.param("tripId");
      const targetUserId = context.req.param("userId");
      const [actor] = await services.database
        .select({ role: schema.tripMemberships.role })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, session.user.id),
          ),
        )
        .limit(1);
      if (!actor) return context.json({ error: "not_found" }, 404);
      if (actor.role !== "manager")
        return context.json({ error: "forbidden" }, 403);
      const [target] = await services.database
        .select({ email: schema.users.email })
        .from(schema.tripMemberships)
        .innerJoin(
          schema.users,
          eq(schema.tripMemberships.userId, schema.users.id),
        )
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, targetUserId),
          ),
        )
        .limit(1);
      if (!target) return context.json({ error: "not_found" }, 404);
      const magicLinkCapture = services.magicLinkCapture;
      if (!magicLinkCapture)
        return context.json({ error: "sign_in_link_generation_failed" }, 503);
      const requestId = randomUUID();
      magicLinkCapture.authorize(requestId);

      const configuredAuthOrigin =
        authEnvironment.BETTER_AUTH_URL?.trim() ||
        (authEnvironment.VERCEL_BRANCH_URL
          ? `https://${authEnvironment.VERCEL_BRANCH_URL.trim()}`
          : authEnvironment.VERCEL_URL
            ? `https://${authEnvironment.VERCEL_URL.trim()}`
            : "http://127.0.0.1:5173");
      const requestOrigin = context.req.header("origin");
      const authOrigin =
        requestOrigin && isTrustedAuthOrigin(requestOrigin, authEnvironment)
          ? new URL(requestOrigin).origin
          : configuredAuthOrigin;
      const response = await handleMagicLinkRequest(
        services,
        new Request(`${authOrigin}/api/auth/sign-in/magic-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: authOrigin },
          body: JSON.stringify({
            email: target.email,
            callbackURL: `/trips/${encodeURIComponent(tripId)}`,
            metadata: { copySignInLinkRequestId: requestId },
          }),
        }),
        { awaitProcessing: true },
      );
      if (response.status === 429) {
        magicLinkCapture.take(requestId);
        return context.json(
          { error: "rate_limited" },
          {
            status: 429,
            headers: {
              "Retry-After":
                response.headers.get("Retry-After") ??
                response.headers.get("X-Retry-After") ??
                "30",
            },
          },
        );
      }
      if (!response.ok) {
        magicLinkCapture.take(requestId);
        return context.json({ error: "sign_in_link_generation_failed" }, 503);
      }
      const link = magicLinkCapture.take(requestId);
      if (!link)
        return context.json({ error: "sign_in_link_generation_failed" }, 503);
      return context.json({ link });
    },
  );

  app.post("/api/trips/:tripId/imports/preview", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);
    let form: FormData;
    try {
      form = await context.req.formData();
    } catch {
      return context.json({ error: "invalid_import_file" }, 400);
    }
    const file = form.get("file");
    const sourceType = form.get("sourceType");
    if (
      sourceType !== "validated_roster" &&
      sourceType !== "detailed_orders" &&
      sourceType !== "companions_vips" &&
      sourceType !== "agency_rooming"
    ) {
      return context.json({ error: "invalid_import_source" }, 400);
    }
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
      return context.json({ error: "xlsx_file_required" }, 400);
    }
    if (file.size < 1 || file.size > 4 * 1024 * 1024) {
      return context.json({ error: "import_file_size_not_allowed" }, 413);
    }
    const data = await file.arrayBuffer();
    const parsed = await parseImportSource(sourceType, data);
    if (parsed.errors.length)
      return context.json({ errors: parsed.errors }, 422);
    let summary: unknown;
    let staffRows: unknown;
    let availableMembers: unknown;
    let agencyRows: unknown;
    let changes: unknown;
    if (parsed.sourceType === "validated_roster") {
      const rosterPreview = await previewValidatedRoster(
        services.database,
        tripId,
        parsed.rows,
      );
      const { changes: rosterChanges, ...counts } = rosterPreview;
      summary = counts;
      changes = rosterChanges;
    } else if (parsed.sourceType === "detailed_orders") {
      const detailPreview = await previewDetailedOrders(
        services.database,
        tripId,
        parsed.rows,
      );
      const { changes: detailChanges, ...counts } = detailPreview;
      summary = counts;
      changes = detailChanges;
    } else if (parsed.sourceType === "companions_vips") {
      const staffPreview = await previewStaffImport(
        services.database,
        tripId,
        parsed.rows,
      );
      staffRows = staffPreview.rows;
      availableMembers = staffPreview.availableMembers;
      summary = { rows: staffPreview.rows.length };
    } else {
      const agencyPreview = await previewAgencyRooming(
        services.database,
        tripId,
        parsed.rows,
      );
      const { rows: matchedRows, ...counts } = agencyPreview;
      summary = counts;
      agencyRows = matchedRows;
    }
    const now = new Date();
    await services.database
      .delete(schema.tripImportPreviews)
      .where(lte(schema.tripImportPreviews.expiresAt, now));
    const previewId = randomUUID();
    const baseSnapshotHash = await getImportBaselineHash(
      services.database,
      tripId,
    );
    await services.database.insert(schema.tripImportPreviews).values({
      id: previewId,
      tripId,
      actorUserId: session.user.id,
      sourceType,
      contentHash: createHash("sha256")
        .update(new Uint8Array(data))
        .digest("hex"),
      baseSnapshotHash,
      expiresAt: new Date(now.getTime() + 15 * 60_000),
      createdAt: now,
    });
    return context.json({
      previewId,
      sourceType,
      summary,
      staffRows,
      availableMembers,
      agencyRows,
      changes,
    });
  });

  app.post("/api/trips/:tripId/imports/commit", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);
    let form: FormData;
    try {
      form = await context.req.formData();
    } catch {
      return context.json({ error: "invalid_import_file" }, 400);
    }
    const file = form.get("file");
    const sourceType = form.get("sourceType");
    const previewId = form.get("previewId");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
      return context.json({ error: "xlsx_file_required" }, 400);
    }
    if (file.size < 1 || file.size > 4 * 1024 * 1024) {
      return context.json({ error: "import_file_size_not_allowed" }, 413);
    }
    if (
      typeof previewId !== "string" ||
      (sourceType !== "validated_roster" &&
        sourceType !== "detailed_orders" &&
        sourceType !== "companions_vips" &&
        sourceType !== "agency_rooming")
    ) {
      return context.json({ error: "invalid_import_confirmation" }, 400);
    }
    const [preview] = await services.database
      .select()
      .from(schema.tripImportPreviews)
      .where(
        and(
          eq(schema.tripImportPreviews.id, previewId),
          eq(schema.tripImportPreviews.tripId, tripId),
          eq(schema.tripImportPreviews.actorUserId, session.user.id),
          eq(schema.tripImportPreviews.sourceType, sourceType),
          sql`${schema.tripImportPreviews.expiresAt} > ${new Date()}`,
        ),
      )
      .limit(1);
    if (!preview) return context.json({ error: "import_preview_expired" }, 409);
    const currentBaselineHash = await getImportBaselineHash(
      services.database,
      tripId,
    );
    if (currentBaselineHash !== preview.baseSnapshotHash) {
      return context.json({ error: "import_preview_stale" }, 409);
    }
    const data = await file.arrayBuffer();
    const contentHash = createHash("sha256")
      .update(new Uint8Array(data))
      .digest("hex");
    if (contentHash !== preview.contentHash) {
      return context.json({ error: "import_file_changed" }, 409);
    }
    const parsed = await parseImportSource(sourceType, data);
    if (parsed.errors.length)
      return context.json({ errors: parsed.errors }, 422);
    try {
      let result: unknown;
      if (parsed.sourceType === "validated_roster") {
        result = await importValidatedRoster(
          services.database,
          tripId,
          parsed.rows,
        );
      } else if (parsed.sourceType === "detailed_orders") {
        result = await importDetailedOrders(
          services.database,
          tripId,
          parsed.rows,
        );
      } else if (parsed.sourceType === "companions_vips") {
        const managerEmailsValue = form.get("managerEmails");
        const accountMappingsValue = form.get("accountMappings");
        let managerEmails: string[] = [];
        let accountMappings: Record<string, string> = {};
        if (typeof managerEmailsValue === "string") {
          try {
            const parsedEmails: unknown = JSON.parse(managerEmailsValue);
            if (
              !Array.isArray(parsedEmails) ||
              parsedEmails.some((email) => typeof email !== "string")
            ) {
              return context.json(
                { error: "invalid_manager_assignments" },
                400,
              );
            }
            managerEmails = parsedEmails;
          } catch {
            return context.json({ error: "invalid_manager_assignments" }, 400);
          }
        }
        if (typeof accountMappingsValue === "string") {
          try {
            const parsedMappings: unknown = JSON.parse(accountMappingsValue);
            if (
              !parsedMappings ||
              typeof parsedMappings !== "object" ||
              Array.isArray(parsedMappings) ||
              Object.values(parsedMappings).some(
                (userId) => typeof userId !== "string",
              )
            ) {
              return context.json({ error: "invalid_account_mappings" }, 400);
            }
            accountMappings = parsedMappings as Record<string, string>;
          } catch {
            return context.json({ error: "invalid_account_mappings" }, 400);
          }
        }
        result = await importStaffRows(
          services.database,
          tripId,
          parsed.rows,
          managerEmails,
          accountMappings,
        );
      } else {
        result = await importAgencyRooming(
          services.database,
          tripId,
          parsed.rows,
        );
      }
      await services.database
        .delete(schema.tripImportPreviews)
        .where(eq(schema.tripImportPreviews.id, preview.id));
      return context.json({ status: "imported", result });
    } catch (error) {
      if (error instanceof InvalidStaffAccountMappingError)
        return context.json({ error: "invalid_account_mappings" }, 422);
      if (error instanceof InvalidAgencyRoomingMatchError)
        return context.json({ error: "agency_rooming_name_match_failed" }, 422);
      if (error instanceof DuplicateNormalizedEmailError)
        return context.json({ error: "duplicate_email_accounts" }, 409);
      return context.json({ error: "participant_import_failed" }, 503);
    }
  });

  app.post("/api/trips/:tripId/travelers/:userId/tickets", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const targetUserId = context.req.param("userId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role === "traveler")
      return context.json({ error: "forbidden" }, 403);
    const [target] = await services.database
      .select({ userId: schema.tripMemberships.userId })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, targetUserId),
        ),
      )
      .limit(1);
    if (!target) return context.json({ error: "not_found" }, 404);

    let form: FormData;
    try {
      form = await context.req.formData();
    } catch {
      return context.json({ error: "invalid_upload" }, 400);
    }
    const file = form.get("file");
    const kind = form.get("kind");
    if (
      !(file instanceof File) ||
      !(kind === "outbound" || kind === "return" || kind === "other")
    ) {
      return context.json({ error: "invalid_upload" }, 400);
    }
    if (file.size < 1 || file.size > 4 * 1024 * 1024) {
      return context.json({ error: "file_size_not_allowed" }, 413);
    }
    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
    ]);
    if (!allowedTypes.has(file.type))
      return context.json({ error: "file_type_not_allowed" }, 415);
    if (!ticketStorageAvailable()) {
      return context.json({ error: "ticket_storage_unavailable" }, 503);
    }

    const id = randomUUID();
    const blobPath = createTicketBlobPath(tripId, targetUserId, id);
    let blobCreated = false;
    try {
      await ticketStorage.put(blobPath, file, {
        access: "private",
        contentType: file.type,
        addRandomSuffix: false,
      });
      blobCreated = true;
      await services.database.insert(schema.transportTickets).values({
        id,
        tripId,
        userId: targetUserId,
        kind,
        blobPath,
        originalName: file.name.replace(/[\r\n\\/]/g, "_").slice(0, 180),
        contentType: file.type,
        size: file.size,
        uploadedBy: session.user.id,
      });
    } catch {
      if (blobCreated) await ticketStorage.del(blobPath).catch(() => undefined);
      return context.json({ error: "ticket_upload_failed" }, 503);
    }
    return context.json({ status: "uploaded", ticketId: id }, 201);
  });

  app.get("/api/trips/:tripId/tickets/:ticketId", async (context) => {
    context.header("Cache-Control", "private, no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [membership] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership) return context.json({ error: "not_found" }, 404);
    const [ticket] = await services.database
      .select()
      .from(schema.transportTickets)
      .where(
        and(
          eq(schema.transportTickets.tripId, tripId),
          eq(schema.transportTickets.id, context.req.param("ticketId")),
        ),
      )
      .limit(1);
    if (!ticket) return context.json({ error: "not_found" }, 404);
    if (ticket.userId !== session.user.id && membership.role === "traveler") {
      return context.json({ error: "not_found" }, 404);
    }
    try {
      const blob = await ticketStorage.get(ticket.blobPath, {
        access: "private",
      });
      if (blob?.statusCode !== 200 || !blob.stream)
        return context.json({ error: "not_found" }, 404);
      return new Response(blob.stream, {
        headers: {
          "Content-Type": ticket.contentType,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ticket.originalName)}`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      return context.json({ error: "ticket_storage_unavailable" }, 503);
    }
  });

  app.notFound((context) => context.json({ error: "not_found" }, 404));

  return app;
}

export type TravelerDetailsInput = {
  activityProfile: "ski" | "spa" | null;
  skiDayThree: boolean;
  transportMode: "train" | "flight" | "none" | null;
  departureCity: string | null;
  outboundDateTime: string | null;
  outboundTimezone: string | null;
  outboundMeetingTime: string | null;
  outboundDepartureTime: string | null;
  outboundLocation: string | null;
  outboundReference: string | null;
  outboundSeat: string | null;
  returnDateTime: string | null;
  returnTimezone: string | null;
  returnMeetingTime: string | null;
  returnDepartureTime: string | null;
  returnLocation: string | null;
  returnReference: string | null;
  returnSeat: string | null;
  carpoolPreference: boolean | null;
  parkingPreference: boolean | null;
};

const travelerDetailFields = [
  "activityProfile",
  "skiDayThree",
  "transportMode",
  "departureCity",
  "outboundDateTime",
  "outboundTimezone",
  "outboundMeetingTime",
  "outboundDepartureTime",
  "outboundLocation",
  "outboundReference",
  "outboundSeat",
  "returnDateTime",
  "returnTimezone",
  "returnMeetingTime",
  "returnDepartureTime",
  "returnLocation",
  "returnReference",
  "returnSeat",
  "carpoolPreference",
  "parkingPreference",
] as const;

async function parseTravelerDetails(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false as const };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false as const };
  }
  const record = body as Record<string, unknown>;
  if (travelerDetailFields.some((field) => !(field in record))) {
    return { ok: false as const };
  }
  const nullableStrings = travelerDetailFields.filter(
    (field) => field !== "skiDayThree" && !field.endsWith("Preference"),
  );
  for (const field of nullableStrings) {
    const value = record[field];
    if (value !== null && typeof value !== "string")
      return { ok: false as const };
    if (typeof value === "string" && value.length > 300)
      return { ok: false as const };
  }
  if (typeof record.skiDayThree !== "boolean") return { ok: false as const };
  for (const field of ["carpoolPreference", "parkingPreference"] as const) {
    if (record[field] !== null && typeof record[field] !== "boolean") {
      return { ok: false as const };
    }
  }
  return { ok: true as const, value: record as TravelerDetailsInput };
}

function validateTravelerDetails(details: TravelerDetailsInput) {
  if (
    details.activityProfile &&
    !["ski", "spa"].includes(details.activityProfile)
  ) {
    return "invalid_activity_profile";
  }
  if (
    details.transportMode &&
    !["train", "flight", "none"].includes(details.transportMode)
  ) {
    return "invalid_transport_mode";
  }
  if (
    ![details.outboundDateTime, details.returnDateTime].every(
      isValidTravelDateTime,
    )
  ) {
    return "invalid_travel_datetime";
  }
  if (
    ![
      details.outboundMeetingTime,
      details.outboundDepartureTime,
      details.returnMeetingTime,
      details.returnDepartureTime,
    ].every(isValidTravelTime)
  ) {
    return "invalid_travel_time";
  }
  if (
    ![details.outboundTimezone, details.returnTimezone].every(isValidTimezone)
  ) {
    return "invalid_travel_timezone";
  }
  if (details.skiDayThree && details.activityProfile !== "ski") {
    return "ski_day_requires_ski_profile";
  }
  if (
    details.transportMode !== "none" &&
    (details.carpoolPreference !== null || details.parkingPreference !== null)
  ) {
    return "carpool_requires_no_transport";
  }
  if (details.parkingPreference && !details.carpoolPreference) {
    return "parking_requires_carpool";
  }
  if (details.transportMode === "none") {
    const fields = [
      details.departureCity,
      details.outboundDateTime,
      details.outboundTimezone,
      details.outboundMeetingTime,
      details.outboundDepartureTime,
      details.outboundLocation,
      details.outboundReference,
      details.outboundSeat,
      details.returnDateTime,
      details.returnTimezone,
      details.returnMeetingTime,
      details.returnDepartureTime,
      details.returnLocation,
      details.returnReference,
      details.returnSeat,
    ];
    if (fields.some(Boolean)) return "no_transport_has_no_journey_details";
  }
  return null;
}

function isValidTravelTime(value: string | null) {
  return value === null || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidTravelDateTime(value: string | null) {
  if (value === null) return true;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|([+-]\d{2}:\d{2}))?$/.exec(
      value,
    );
  if (!match) return false;
  const [, year, month, day, hour, minute, second = "0", offset] = match;
  const daysInMonthDate = new Date(0);
  daysInMonthDate.setUTCFullYear(Number(year), Number(month), 0);
  const daysInMonth = daysInMonthDate.getUTCDate();
  const offsetMatch = offset?.match(/^([+-])(\d{2}):(\d{2})$/);
  const validOffset =
    !offsetMatch ||
    (Number(offsetMatch[2]) <= 23 && Number(offsetMatch[3]) <= 59);
  return (
    Number(month) >= 1 &&
    Number(month) <= 12 &&
    Number(day) >= 1 &&
    Number(day) <= daysInMonth &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59 &&
    validOffset
  );
}

export function synchronizeDepartureTimes(details: TravelerDetailsInput) {
  return {
    ...details,
    outboundDateTime: withDepartureTime(
      details.outboundDateTime,
      details.outboundDepartureTime,
    ),
    returnDateTime: withDepartureTime(
      details.returnDateTime,
      details.returnDepartureTime,
    ),
  };
}

function withDepartureTime(
  dateTime: string | null,
  departureTime: string | null,
) {
  if (!dateTime || !departureTime) return dateTime;
  const match =
    /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.exec(
      dateTime,
    );
  if (!match) return dateTime;
  return `${match[1]}T${departureTime}:00${match[2] ?? ""}`;
}

function isValidTimezone(value: string | null) {
  if (value === null) return true;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

async function handleMagicLinkRequest(
  services: AuthServices,
  request: Request,
  options: { awaitProcessing?: boolean } = {},
) {
  const normalized = await normalizeMagicLinkRequest(request);
  if (normalized.email) {
    const retryAfter = await enforceMagicLinkEmailCooldown(
      services,
      normalized.email,
    );
    if (retryAfter !== null) {
      return Response.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(retryAfter),
          },
        },
      );
    }
  }

  const processRequest = async () => {
    const response = await services.auth.handler(normalized.request);
    if (response.status >= 500) {
      console.error("Magic link request processing failed.", response.status);
    }
    return response;
  };

  if (options.awaitProcessing) {
    try {
      const response = await processRequest();
      if (response.status === 429) {
        return Response.json(
          { error: "rate_limited" },
          {
            status: 429,
            headers: {
              "Cache-Control": "no-store",
              "Retry-After":
                response.headers.get("Retry-After") ??
                response.headers.get("X-Retry-After") ??
                "30",
            },
          },
        );
      }
      if (!response.ok) {
        return Response.json(
          { error: "email_delivery_failed" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    } catch (error) {
      console.error(
        "Magic link request processing failed.",
        error instanceof Error ? error.name : "UnknownError",
      );
      return Response.json(
        { error: "email_delivery_failed" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { status: "accepted" },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  const task = Promise.resolve()
    .then(processRequest)
    .catch((error: unknown) => {
      console.error(
        "Magic link request processing failed.",
        error instanceof Error ? error.name : "UnknownError",
      );
    });
  services.scheduleBackgroundTask(task);

  // Acknowledge before account lookup so membership cannot be inferred by timing.
  return Response.json(
    { status: "accepted" },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

async function normalizeMagicLinkRequest(request: Request) {
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return { request };
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("email" in body) ||
    typeof body.email !== "string"
  ) {
    return { request };
  }

  const email = normalizeEmail(body.email);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return {
    email,
    request: new Request(request.url, {
      method: request.method,
      headers,
      body: JSON.stringify({ ...body, email }),
    }),
  };
}

async function enforceMagicLinkEmailCooldown(
  services: AuthServices,
  email: string,
) {
  const now = Date.now();
  const key = `magic-link-email:${createHash("sha256").update(email).digest("hex")}`;
  const accepted = await services.database
    .insert(schema.rateLimits)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: { count: 1, lastRequest: now },
      setWhere: lte(
        schema.rateLimits.lastRequest,
        now - magicLinkEmailCooldownMs,
      ),
    })
    .returning({ id: schema.rateLimits.id });

  if (accepted.length > 0) return null;

  const [existing] = await services.database
    .select({ lastRequest: schema.rateLimits.lastRequest })
    .from(schema.rateLimits)
    .where(eq(schema.rateLimits.key, key))
    .limit(1);
  if (!existing) return Math.ceil(magicLinkEmailCooldownMs / 1000);

  return Math.max(
    1,
    Math.ceil(
      (existing.lastRequest + magicLinkEmailCooldownMs - Date.now()) / 1000,
    ),
  );
}

async function getSession(
  services: AuthServices,
  headers: Headers,
): Promise<Awaited<ReturnType<typeof services.auth.api.getSession>>> {
  return services.auth.api.getSession({ headers });
}

type ParsedImportSource =
  | ({ sourceType: "agency_rooming" } & {
      rows: AgencyRoomingRow[];
      errors: ImportError[];
    })
  | ({ sourceType: "validated_roster" } & {
      rows: ValidatedRosterRow[];
      errors: ImportError[];
    })
  | ({ sourceType: "detailed_orders" } & {
      rows: DetailedOrderRow[];
      errors: ImportError[];
    })
  | ({ sourceType: "companions_vips" } & {
      rows: StaffImportRow[];
      errors: ImportError[];
    });

async function parseImportSource(
  sourceType: string,
  data: ArrayBuffer,
): Promise<ParsedImportSource> {
  if (sourceType === "validated_roster") {
    return { sourceType, ...(await parseValidatedRoster(data)) };
  }
  if (sourceType === "detailed_orders") {
    return { sourceType, ...(await parseDetailedOrders(data)) };
  }
  if (sourceType === "agency_rooming") {
    return { sourceType, ...(await parseAgencyRooming(data)) };
  }
  return {
    sourceType: "companions_vips",
    ...(await parseCompanionsAndVips(data)),
  };
}

function normalizeSheetHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fr");
}

function agencyRoomingColumns(sheet: ExcelJS.Worksheet) {
  const columns = new Map<string, number>();
  const headers = sheet.getRow(1).values as unknown[];
  for (let column = 1; column < headers.length; column += 1) {
    const value = normalizeSheetHeader(String(headers[column] ?? ""));
    if (value) columns.set(value, column);
  }
  return columns;
}

function roomCapacity(roomType: string) {
  const normalized = roomType.toLocaleUpperCase("fr");
  if (normalized.includes("QUAD")) return 4;
  if (normalized.includes("TRIPLE")) return 3;
  const match = normalized.match(/\b(\d+)\s*(?:PAX|PLACES?)\b/);
  return match ? Number(match[1]) : null;
}

function setAgencyCell(
  row: ExcelJS.Row,
  columns: Map<string, number>,
  header: string,
  value: string,
) {
  const column = columns.get(normalizeSheetHeader(header));
  if (column) row.getCell(column).value = value;
}

const app = createApp();

export default app;
