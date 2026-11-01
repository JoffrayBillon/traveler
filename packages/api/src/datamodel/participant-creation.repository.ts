import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";

export async function appointCompanion(
  database: AppDatabase,
  tripId: string,
  email: string,
  firstName: string,
  lastName: string,
) {
  return database.transaction(async (transaction) => {
    const existingUsers = await transaction
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(sql<string>`lower(${schema.users.email})`, email))
      .limit(2);
    if (existingUsers.length > 1)
      return { error: "duplicate_email_accounts" as const };
    const existingUser = existingUsers[0];
    const userId = existingUser?.id ?? randomUUID();
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
      return { error: "manager_role_is_protected" as const };
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
    return { companion: { email, firstName, lastName } };
  });
}

export async function createTravelerMembership(
  database: AppDatabase,
  tripId: string,
  email: string,
  firstName: string,
  lastName: string,
) {
  return database.transaction(async (transaction) => {
    const existingUsers = await transaction
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(sql<string>`lower(${schema.users.email})`, email))
      .limit(2);
    if (existingUsers.length > 1)
      return { error: "duplicate_email_accounts" as const };
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
    if (existingMembership)
      return { error: "participant_already_exists" as const };

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
    return {
      participant: { userId, firstName, lastName, email, role: "traveler" },
    };
  });
}
