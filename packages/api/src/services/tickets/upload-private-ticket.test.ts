import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, it, vi } from "vitest";
import * as schema from "../../schema";
import { purgeExpiredTrips } from "../purge-expired-trips";
import { uploadPrivateTicket } from "./upload-private-ticket";

it("requeues a late blob if the original upload intent was already cleaned up", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    const database = drizzle({ client, schema });
    await migrate(database, {
      migrationsFolder: fileURLToPath(
        new URL("../../../drizzle", import.meta.url),
      ),
    });
    const blobPath = "local/ticket-created-late";
    const del = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Storage is temporarily unavailable"))
      .mockResolvedValue(undefined);
    const storage = {
      get: vi.fn(),
      del,
      put: vi.fn(async () => {
        const afterGracePeriod = new Date(Date.now() + 31 * 60_000);
        expect(
          await purgeExpiredTrips(database, storage, afterGracePeriod),
        ).toMatchObject({ deleted: 1, failed: 0 });
      }),
    };
    const publish = vi.fn();
    await expect(
      uploadPrivateTicket(
        database,
        storage,
        blobPath,
        new File(["pdf"], "ticket.pdf", { type: "application/pdf" }),
        publish,
      ),
    ).rejects.toThrow("The ticket upload intent has expired.");
    expect(publish).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalledTimes(2);
    expect(
      await database.select().from(schema.pendingTicketBlobDeletions),
    ).toEqual([{ blobPath, availableAt: 0 }]);
    expect(await purgeExpiredTrips(database, storage)).toMatchObject({
      deleted: 1,
      failed: 0,
    });
    expect(
      await database.select().from(schema.pendingTicketBlobDeletions),
    ).toEqual([]);
    expect(del.mock.calls).toEqual([[blobPath], [blobPath], [blobPath]]);
  } finally {
    await client.close();
  }
});
