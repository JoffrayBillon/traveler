import { and, eq, gt } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import type { TicketBlobStorage } from "../../ports/ticket-storage";
import { pendingTicketBlobDeletions as pending } from "../../schema";
import type { DatabaseTransaction } from "../../source-imports/database.types";
import { deleteQueuedTicketBlobs } from "./delete-queued-ticket-blobs";

const uploadGraceMs = 30 * 60 * 1000;

export async function uploadPrivateTicket(
  database: AppDatabase,
  storage: TicketBlobStorage,
  blobPath: string,
  file: File,
  publish: (transaction: DatabaseTransaction) => Promise<void>,
) {
  await database.insert(pending).values({
    blobPath,
    availableAt: Date.now() + uploadGraceMs,
  });
  try {
    await storage.put(blobPath, file, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: false,
    });
    await database.transaction(async (transaction) => {
      const [intent] = await transaction
        .delete(pending)
        .where(
          and(
            eq(pending.blobPath, blobPath),
            gt(pending.availableAt, Date.now()),
          ),
        )
        .returning({ blobPath: pending.blobPath });
      if (!intent) throw new Error("The ticket upload intent has expired.");
      await publish(transaction);
    });
  } catch (error) {
    try {
      const [abandoned] = await database
        .update(pending)
        .set({ availableAt: 0 })
        .where(eq(pending.blobPath, blobPath))
        .returning({ blobPath: pending.blobPath });
      if (abandoned)
        await deleteQueuedTicketBlobs(database, storage, [blobPath]);
    } catch {
      // The durable intent becomes eligible when its grace period expires.
    }
    throw error;
  }
}
