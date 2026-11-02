import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import * as schema from "../schema";
import type { DatabaseExecutor } from "./database.types";

export async function getImportBaselineHash(
  database: DatabaseExecutor,
  tripId: string,
) {
  const [registrations, members, assignments, seats] = await Promise.all([
    database
      .select({
        reference: schema.tripRegistrations.reference,
        status: schema.tripRegistrations.status,
        updatedAt: schema.tripRegistrations.updatedAt,
      })
      .from(schema.tripRegistrations)
      .where(eq(schema.tripRegistrations.tripId, tripId))
      .orderBy(schema.tripRegistrations.reference),
    database
      .select({
        userId: schema.tripMemberships.userId,
        role: schema.tripMemberships.role,
        firstName: schema.tripMemberships.firstName,
        lastName: schema.tripMemberships.lastName,
      })
      .from(schema.tripMemberships)
      .where(eq(schema.tripMemberships.tripId, tripId))
      .orderBy(schema.tripMemberships.userId),
    database
      .select({
        userId: schema.roomAssignments.userId,
        roomId: schema.roomAssignments.roomId,
      })
      .from(schema.roomAssignments)
      .where(eq(schema.roomAssignments.tripId, tripId))
      .orderBy(schema.roomAssignments.userId),
    database
      .select({
        userId: schema.travelerDetails.userId,
        outboundSeat: schema.travelerDetails.outboundSeat,
        returnSeat: schema.travelerDetails.returnSeat,
      })
      .from(schema.travelerDetails)
      .where(eq(schema.travelerDetails.tripId, tripId))
      .orderBy(schema.travelerDetails.userId),
  ]);
  return createHash("sha256")
    .update(JSON.stringify([registrations, members, assignments, seats]))
    .digest("hex");
}
