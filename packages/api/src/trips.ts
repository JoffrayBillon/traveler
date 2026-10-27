import { randomUUID } from "node:crypto";
import { asc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export class TripNameRequiredError extends Error {
  constructor() {
    super("A trip name is required.");
    this.name = "TripNameRequiredError";
  }
}

export function createTripsStore(database: LibSQLDatabase<typeof schema>) {
  return {
    async create(name: string) {
      const normalizedName = name.trim();
      if (!normalizedName) {
        throw new TripNameRequiredError();
      }

      const [trip] = await database
        .insert(schema.trips)
        .values({ id: randomUUID(), name: normalizedName })
        .returning();

      if (!trip) {
        throw new Error("The trip could not be created.");
      }

      return trip;
    },

    list() {
      return database
        .select()
        .from(schema.trips)
        .orderBy(asc(schema.trips.name), asc(schema.trips.id));
    },
  };
}
