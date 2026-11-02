import { and, eq, lte } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import type { TicketBlobStorage } from "../../ports/ticket-storage";
import * as schema from "../../schema";

const RETENTION_DAYS = 90;

export async function deleteExpiredTickets(
  database: AppDatabase,
  storage: TicketBlobStorage,
  now = new Date(),
) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const expired = await database
    .select({
      id: schema.transportTickets.id,
      blobPath: schema.transportTickets.blobPath,
    })
    .from(schema.transportTickets)
    .innerJoin(
      schema.trips,
      eq(schema.trips.id, schema.transportTickets.tripId),
    )
    .where(and(lte(schema.trips.endsOn, cutoffDate)));

  let deleted = 0;
  for (const ticket of expired) {
    try {
      await storage.del(ticket.blobPath);
      await database
        .delete(schema.transportTickets)
        .where(eq(schema.transportTickets.id, ticket.id));
      deleted += 1;
    } catch {
      // Keep the row so tomorrow's scheduled run can safely retry the deletion.
    }
  }
  return { deleted, failed: expired.length - deleted };
}
