import { inArray, lte } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import type { TicketBlobStorage } from "../../ports/ticket-storage";
import * as schema from "../../schema";
import { deleteQueuedTicketBlobs } from "./delete-queued-ticket-blobs";

const RETENTION_DAYS = 90;

export async function deleteExpiredTickets(
  database: AppDatabase,
  storage: TicketBlobStorage,
  now = new Date(),
) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const pending = schema.pendingTicketBlobDeletions;
  await database.transaction(async (transaction) => {
    const expiredTrips = transaction
      .select({ id: schema.trips.id })
      .from(schema.trips)
      .where(lte(schema.trips.endsOn, cutoffDate));
    const expired = await transaction
      .delete(schema.transportTickets)
      .where(inArray(schema.transportTickets.tripId, expiredTrips))
      .returning({ blobPath: schema.transportTickets.blobPath });
    if (expired.length) {
      await transaction.insert(pending).values(expired).onConflictDoNothing();
    }
  });

  const due = await database
    .select({ blobPath: pending.blobPath })
    .from(pending)
    .where(lte(pending.availableAt, now.getTime()));
  return deleteQueuedTicketBlobs(
    database,
    storage,
    due.map(({ blobPath }) => blobPath),
  );
}
