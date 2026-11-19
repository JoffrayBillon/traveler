import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import type { TicketBlobStorage } from "../../ports/ticket-storage";
import { pendingTicketBlobDeletions } from "../../schema";

export async function deleteQueuedTicketBlobs(
  database: AppDatabase,
  storage: TicketBlobStorage,
  blobPaths: readonly string[],
) {
  let deleted = 0;
  for (const path of blobPaths) {
    try {
      await storage.del(path);
      await database
        .delete(pendingTicketBlobDeletions)
        .where(eq(pendingTicketBlobDeletions.blobPath, path));
      deleted += 1;
    } catch {
      // Leave the path queued for the scheduled retry.
    }
  }
  return { deleted, failed: blobPaths.length - deleted };
}
