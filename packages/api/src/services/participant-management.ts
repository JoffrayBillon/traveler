import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import {
  createTravelerMembership,
  appointCompanion as persistCompanion,
} from "../datamodel/participant-creation.repository";
import { normalizeEmail } from "../email";
import * as schema from "../schema";

export async function updateParticipantRole(
  database: AppDatabase,
  tripId: string,
  userId: string,
  role: "traveler" | "companion" | "manager",
) {
  return database.transaction(async (transaction) => {
    const [current] = await transaction
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, userId),
        ),
      )
      .limit(1);
    if (!current) return "not_found" as const;

    if (current.role === "manager" && role !== "manager") {
      const managers = await transaction
        .select({ userId: schema.tripMemberships.userId })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.role, "manager"),
          ),
        );
      if (managers.length <= 1) return "last_manager_required" as const;
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
    return "updated" as const;
  });
}

export async function createTravelerParticipant(
  database: AppDatabase,
  tripId: string,
  body: unknown,
) {
  const parsed = parseParticipantIdentity(body, 320);
  if (!parsed) return { error: "invalid_participant" } as const;
  return createTravelerMembership(
    database,
    tripId,
    parsed.email,
    parsed.firstName,
    parsed.lastName,
  );
}

export async function appointTripCompanion(
  database: AppDatabase,
  tripId: string,
  body: unknown,
) {
  const parsed = parseParticipantIdentity(body);
  if (!parsed) return { error: "invalid_companion" } as const;
  return persistCompanion(
    database,
    tripId,
    parsed.email,
    parsed.firstName,
    parsed.lastName,
  );
}

function parseParticipantIdentity(body: unknown, maxEmailLength?: number) {
  const input =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const email =
    typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const firstName =
    typeof input.firstName === "string" ? input.firstName.trim() : "";
  const lastName =
    typeof input.lastName === "string" ? input.lastName.trim() : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (maxEmailLength !== undefined && email.length > maxEmailLength) ||
    !firstName ||
    !lastName ||
    firstName.length > 100 ||
    lastName.length > 100
  )
    return null;
  return { email, firstName, lastName };
}

export async function updateParticipantEmail(
  database: AppDatabase,
  tripId: string,
  userId: string,
  rawEmail: string,
) {
  const email = normalizeEmail(rawEmail);
  const [target] = await database
    .select({ email: schema.users.email })
    .from(schema.tripMemberships)
    .innerJoin(schema.users, eq(schema.tripMemberships.userId, schema.users.id))
    .where(
      and(
        eq(schema.tripMemberships.tripId, tripId),
        eq(schema.tripMemberships.userId, userId),
      ),
    )
    .limit(1);
  if (!target) return { status: "not_found" } as const;

  const oldEmail = normalizeEmail(target.email);
  if (oldEmail === email) return { status: "unchanged", email } as const;
  const [collision] = await database
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        sql<string>`lower(${schema.users.email}) = ${email}`,
        sql`${schema.users.id} <> ${userId}`,
      ),
    )
    .limit(1);
  if (collision) return { status: "email_in_use" } as const;

  try {
    await database.transaction(async (transaction) => {
      await transaction
        .update(schema.users)
        .set({ email, emailVerified: false, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
      await transaction
        .delete(schema.sessions)
        .where(eq(schema.sessions.userId, userId));
      await transaction
        .delete(schema.verifications)
        .where(eq(schema.verifications.identifier, oldEmail));
    });
  } catch {
    return { status: "email_in_use" } as const;
  }
  return { status: "updated", email } as const;
}
