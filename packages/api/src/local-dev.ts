import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const LOCAL_DEMO_TRIP_ID = "local-demo-trip";

type LocalDemoAccount = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "manager" | "companion" | "traveler";
};

export const LOCAL_DEMO_ACCOUNTS: LocalDemoAccount[] = [
  {
    id: "local-demo-manager",
    email: "manager@traveler.local",
    firstName: "Gestionnaire",
    lastName: "Démo",
    role: "manager",
  },
  {
    id: "local-demo-companion-01",
    email: "accompagnateur1@traveler.local",
    firstName: "Camille",
    lastName: "Martin",
    role: "companion",
  },
  {
    id: "local-demo-companion-02",
    email: "accompagnateur2@traveler.local",
    firstName: "Morgan",
    lastName: "Petit",
    role: "companion",
  },
  ...[
    ["Léa", "Bernard"],
    ["Hugo", "Dubois"],
    ["Inès", "Thomas"],
    ["Noah", "Robert"],
    ["Jade", "Richard"],
    ["Adam", "Durand"],
    ["Mia", "Leroy"],
    ["Louis", "Moreau"],
    ["Sarah", "Simon"],
    ["Gabriel", "Laurent"],
  ].map<LocalDemoAccount>(([firstName, lastName], index) => ({
    id: `local-demo-traveler-${String(index + 1).padStart(2, "0")}`,
    email: `voyageur${String(index + 1).padStart(2, "0")}@traveler.local`,
    firstName: firstName ?? "Voyageur",
    lastName: lastName ?? "Démo",
    role: "traveler",
  })),
];

export async function seedLocalDemoData(
  database: LibSQLDatabase<typeof schema>,
) {
  return database.transaction(async (transaction) => {
    const now = new Date();
    let created = false;
    const [existingTrip] = await transaction
      .select({ id: schema.trips.id })
      .from(schema.trips)
      .where(eq(schema.trips.id, LOCAL_DEMO_TRIP_ID))
      .limit(1);
    if (!existingTrip) {
      await transaction.insert(schema.trips).values({
        id: LOCAL_DEMO_TRIP_ID,
        name: "Voyage de démonstration",
      });
      created = true;
    }

    for (const account of LOCAL_DEMO_ACCOUNTS) {
      let [user] = await transaction
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, account.id))
        .limit(1);
      if (!user) {
        [user] = await transaction
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.email, account.email))
          .limit(1);
      }
      if (!user) {
        await transaction.insert(schema.users).values({
          id: account.id,
          name: `${account.firstName} ${account.lastName}`,
          email: account.email,
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
        });
        user = { id: account.id };
        created = true;
      }

      const [membership] = await transaction
        .select({ id: schema.tripMemberships.id })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, LOCAL_DEMO_TRIP_ID),
            eq(schema.tripMemberships.userId, user.id),
          ),
        )
        .limit(1);
      if (membership) continue;

      await transaction.insert(schema.tripMemberships).values({
        id: randomUUID(),
        tripId: LOCAL_DEMO_TRIP_ID,
        userId: user.id,
        role: account.role,
        firstName: account.firstName,
        lastName: account.lastName,
        gender: null,
      });
      created = true;
    }
    return created;
  });
}
