import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "./auth";
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
      const email = input.email.trim().toLowerCase();
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

        const [existingUser] = await transaction
          .select({ id: schema.users.id, name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1);
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
