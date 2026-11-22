import { lte } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import { eraseExpiredTrips } from "../datamodel/trip-retention.repository";
import type { TicketBlobStorage } from "../ports/ticket-storage";
import { pendingTicketBlobDeletions } from "../schema";
import { deleteQueuedTicketBlobs } from "./tickets/delete-queued-ticket-blobs";

const RETENTION_DAYS = 90;

export async function purgeExpiredTrips(
  database: AppDatabase,
  storage: TicketBlobStorage,
  now = new Date(),
) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  const purgedTrips = await eraseExpiredTrips(
    database,
    cutoff.toISOString().slice(0, 10),
    now,
  );

  const due = await database
    .select({ blobPath: pendingTicketBlobDeletions.blobPath })
    .from(pendingTicketBlobDeletions)
    .where(lte(pendingTicketBlobDeletions.availableAt, now.getTime()));
  const deleted = await deleteQueuedTicketBlobs(
    database,
    storage,
    due.map(({ blobPath }) => blobPath),
  );
  return { purgedTrips, ...deleted };
}
