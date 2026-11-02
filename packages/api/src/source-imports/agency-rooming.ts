import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import { normalizePersonName } from "../source-import/shared";
import type { AgencyRoomingRow } from "../source-import/types";
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
    const now = new Date();
    let updated = 0;
    for (const row of preview.rows) {
      if (!row.userId) continue;
      const values = {
        ...(row.outboundSeat === null
          ? {}
          : { outboundSeat: row.outboundSeat }),
        ...(row.returnSeat === null ? {} : { returnSeat: row.returnSeat }),
        updatedAt: now,
      };
      if (row.outboundSeat === null && row.returnSeat === null) continue;
      const [existing] = await transaction
        .select({ userId: schema.travelerDetails.userId })
        .from(schema.travelerDetails)
        .where(
          and(
            eq(schema.travelerDetails.tripId, tripId),
            eq(schema.travelerDetails.userId, row.userId),
          ),
        )
        .limit(1);
      if (existing) {
        await transaction
          .update(schema.travelerDetails)
          .set(values)
          .where(
            and(
              eq(schema.travelerDetails.tripId, tripId),
              eq(schema.travelerDetails.userId, row.userId),
            ),
          );
      } else {
        await transaction.insert(schema.travelerDetails).values({
          tripId,
          userId: row.userId,
          activityProfile: null,
          skiDayThree: false,
          transportMode: null,
          departureCity: null,
          ...values,
        });
      }
      updated += 1;
    }
    return { updated };
  };
  return existingTransaction
    ? run(existingTransaction)
    : database.transaction(run);
}

export class InvalidAgencyRoomingMatchError extends Error {}
