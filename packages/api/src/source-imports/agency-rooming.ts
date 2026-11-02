import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import { normalizePersonName } from "../source-import/shared";
import type { AgencyRoomingRow } from "../source-import/types";
import { batchRows } from "./batch-rows";
import type { DatabaseExecutor, DatabaseTransaction } from "./database.types";
export async function previewAgencyRooming(
  database: DatabaseExecutor,
  tripId: string,
  rows: AgencyRoomingRow[],
) {
  const members = await database
    .select({
      userId: schema.tripMemberships.userId,
      firstName: sql<string>`coalesce(${schema.travelerProfiles.firstName}, ${schema.tripMemberships.firstName})`,
      lastName: sql<string>`coalesce(${schema.travelerProfiles.lastName}, ${schema.tripMemberships.lastName})`,
      outboundSeat: schema.travelerDetails.outboundSeat,
      returnSeat: schema.travelerDetails.returnSeat,
    })
    .from(schema.tripMemberships)
    .leftJoin(
      schema.travelerProfiles,
      and(
        eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
        eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
      ),
    )
    .leftJoin(
      schema.travelerDetails,
      and(
        eq(schema.travelerDetails.tripId, schema.tripMemberships.tripId),
        eq(schema.travelerDetails.userId, schema.tripMemberships.userId),
      ),
    )
    .where(eq(schema.tripMemberships.tripId, tripId));
  const byName = new Map<string, (typeof members)[number][]>();
  for (const member of members) {
    const key = normalizePersonName(member.firstName, member.lastName);
    byName.set(key, [...(byName.get(key) ?? []), member]);
  }
  const matches = rows.map((row) => {
    const candidates =
      byName.get(normalizePersonName(row.firstName, row.lastName)) ?? [];
    return {
      ...row,
      userId: candidates.length === 1 ? candidates[0]?.userId : null,
      matchCount: candidates.length,
      previousOutboundSeat:
        candidates.length === 1 ? candidates[0]?.outboundSeat : null,
      previousReturnSeat:
        candidates.length === 1 ? candidates[0]?.returnSeat : null,
    };
  });
  return {
    rows: matches,
    matched: matches.filter((row) => row.matchCount === 1).length,
    unmatched: matches.filter((row) => row.matchCount === 0).length,
    ambiguous: matches.filter((row) => row.matchCount > 1).length,
    outboundPlacements: rows.filter((row) => row.outboundSeat).length,
    returnPlacements: rows.filter((row) => row.returnSeat).length,
  };
}

export async function importAgencyRooming(
  database: AppDatabase,
  tripId: string,
  rows: AgencyRoomingRow[],
  existingTransaction?: DatabaseTransaction,
) {
  const run = async (transaction: DatabaseTransaction) => {
    const preview = await previewAgencyRooming(transaction, tripId, rows);
    if (preview.unmatched || preview.ambiguous)
      throw new InvalidAgencyRoomingMatchError();
    const rowsWithSeats = preview.rows.filter(
      (row): row is (typeof preview.rows)[number] & { userId: string } =>
        Boolean(
          row.userId && (row.outboundSeat !== null || row.returnSeat !== null),
        ),
    );
    const userIds = [...new Set(rowsWithSeats.map((row) => row.userId))];
    const existingDetails = userIds.length
      ? await transaction
          .select()
          .from(schema.travelerDetails)
          .where(
            and(
              eq(schema.travelerDetails.tripId, tripId),
              inArray(schema.travelerDetails.userId, userIds),
            ),
          )
      : [];
    const detailsByUser = new Map(
      existingDetails.map((detail) => [detail.userId, detail]),
    );
    const writesByUser = new Map<
      string,
      typeof schema.travelerDetails.$inferInsert
    >();
    const now = new Date();
    for (const row of rowsWithSeats) {
      if (!row.userId) continue;
      const current = writesByUser.get(row.userId) ??
        detailsByUser.get(row.userId) ?? {
          tripId,
          userId: row.userId,
          activityProfile: null,
          skiDayThree: false,
          transportMode: null,
          departureCity: null,
        };
      writesByUser.set(row.userId, {
        ...current,
        outboundSeat: row.outboundSeat ?? current.outboundSeat ?? null,
        returnSeat: row.returnSeat ?? current.returnSeat ?? null,
        updatedAt: now,
      });
    }
    for (const batch of batchRows([...writesByUser.values()]))
      await transaction
        .insert(schema.travelerDetails)
        .values(batch)
        .onConflictDoUpdate({
          target: [
            schema.travelerDetails.tripId,
            schema.travelerDetails.userId,
          ],
          set: {
            outboundSeat: sql`excluded.outbound_seat`,
            returnSeat: sql`excluded.return_seat`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    return { updated: writesByUser.size };
  };
  return existingTransaction
    ? run(existingTransaction)
    : database.transaction(run);
}

export class InvalidAgencyRoomingMatchError extends Error {}
