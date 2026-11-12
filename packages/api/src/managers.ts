import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { AppDatabase } from "./auth";
import { normalizeEmail } from "./email";
import * as schema from "./schema";

export class ManagerProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManagerProvisioningError";
  }
}

export type ManagerProvisioningInput = {
  tripId: string;
  email: string;
  firstName: string;
  lastName: string;
};

export function createManagersStore(database: AppDatabase) {
  return {
    async create(input: ManagerProvisioningInput) {
      const tripId = input.tripId.trim();
      const email = normalizeEmail(input.email);
      const firstName = input.firstName.trim();
      const lastName = input.lastName.trim();
      if (
        !tripId ||
        !firstName ||
        !lastName ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        throw new ManagerProvisioningError(
          "A trip, valid email, first name and last name are required.",
        );
      }

      return database.transaction(async (transaction) => {
        const [trip] = await transaction
          .select({ id: schema.trips.id })
          .from(schema.trips)
          .where(eq(schema.trips.id, tripId))
          .limit(1);
        if (!trip)
          throw new ManagerProvisioningError("The trip does not exist.");

        const existingUsers = await transaction
          .select({ id: schema.users.id, email: schema.users.email })
          .from(schema.users)
          .where(eq(sql<string>`lower(${schema.users.email})`, email))
          .limit(2);
        if (existingUsers.length > 1) {
          throw new ManagerProvisioningError(
            "Multiple existing accounts match this email address, ignoring letter case.",
          );
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
          .insert(schema.tripMemberships)
          .values({
            id: randomUUID(),
            tripId,
            userId,
            role: "manager",
            firstName,
            lastName,
            gender: null,
          })
          .returning();
        if (!membership)
          throw new Error("The manager membership was not created.");
        return { email, tripId, userId, firstName, lastName };
      });
    },
  };
}
