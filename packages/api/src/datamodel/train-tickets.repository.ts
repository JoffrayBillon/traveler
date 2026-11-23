import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import type { DatabaseTransaction } from "../source-imports/database.types";

type DatabaseReader = Pick<AppDatabase, "select">;
const segments = schema.transportGroupSegments;
const seats = schema.trainTicketSeats;
const documents = schema.trainTicketDocuments;

export async function findTrainSegment(
  database: DatabaseReader,
  tripId: string,
  segmentId: string,
) {
  const [segment] = await database
    .select()
    .from(segments)
    .where(
      and(
        eq(segments.tripId, tripId),
        eq(segments.id, segmentId),
        eq(segments.mode, "train"),
      ),
    )
    .limit(1);
  return segment;
}

export function listTrainSeats(
  database: DatabaseReader,
  tripId: string,
  segmentId?: string,
) {
  return database
    .select({
      id: seats.id,
      segmentId: seats.segmentId,
      groupId: segments.groupId,
      documentId: seats.documentId,
      label: seats.label,
      position: seats.position,
      roomId: seats.roomId,
      userId: seats.userId,
      importItemId: seats.importItemId,
      allocation: seats.allocation,
    })
    .from(seats)
    .innerJoin(
      segments,
      and(eq(segments.tripId, seats.tripId), eq(segments.id, seats.segmentId)),
    )
    .where(
      and(
        eq(seats.tripId, tripId),
        eq(segments.mode, "train"),
        segmentId
          ? eq(seats.segmentId, segmentId)
          : or(isNotNull(seats.roomId), isNotNull(seats.userId)),
      ),
    )
    .orderBy(seats.position);
}

export function findTrainTicketDocument(
  database: DatabaseReader,
  tripId: string,
  documentId: string,
) {
  return database
    .select({
      blobPath: documents.blobPath,
      originalName: documents.originalName,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tripId, tripId),
        eq(documents.id, documentId),
        isNull(documents.importHash),
      ),
    )
    .limit(1);
}

export function listTrainPassengers(database: DatabaseReader, tripId: string) {
  const assignments = schema.transportGroupAssignments;
  const memberships = schema.tripMemberships;
  const roomAssignments = schema.roomAssignments;
  return database
    .select({
      userId: memberships.userId,
      groupId: assignments.groupId,
      roomId: schema.rooms.id,
      roomNumber: schema.rooms.name,
      firstName: memberships.firstName,
      lastName: memberships.lastName,
    })
    .from(memberships)
    .innerJoin(
      assignments,
      and(
        eq(assignments.tripId, memberships.tripId),
        eq(assignments.userId, memberships.userId),
      ),
    )
    .leftJoin(
      roomAssignments,
      and(
        eq(roomAssignments.tripId, memberships.tripId),
        eq(roomAssignments.userId, memberships.userId),
      ),
    )
    .leftJoin(
      schema.rooms,
      and(
        eq(schema.rooms.tripId, roomAssignments.tripId),
        eq(schema.rooms.id, roomAssignments.roomId),
      ),
    )
    .where(eq(memberships.tripId, tripId))
    .orderBy(memberships.userId);
}

export function saveTrainSeatAssignments(
  transaction: DatabaseTransaction,
  tripId: string,
  assignments: readonly Pick<
    typeof seats.$inferSelect,
    "id" | "userId" | "roomId"
  >[],
) {
  return transaction.run(sql`
    UPDATE ${seats}
    SET user_id = json_extract(change.value, '$.userId'),
        room_id = json_extract(change.value, '$.roomId')
    FROM json_each(${JSON.stringify(assignments)}) AS change
    WHERE ${seats.tripId} = ${tripId} AND ${seats.id} = json_extract(change.value, '$.id')
  `);
}

export function listTrainTicketDocuments(
  database: DatabaseReader,
  tripId: string,
  segmentId: string,
) {
  return database
    .select({ id: documents.id, originalName: documents.originalName })
    .from(documents)
    .where(
      and(
        eq(documents.tripId, tripId),
        eq(documents.segmentId, segmentId),
        isNull(documents.importHash),
      ),
    )
    .orderBy(documents.createdAt, documents.id);
}

export function listTrainTicketImports(
  database: DatabaseReader,
  tripId: string,
  segmentId: string,
) {
  return database
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.tripId, tripId),
        eq(documents.segmentId, segmentId),
        isNotNull(documents.importHash),
      ),
    )
    .orderBy(documents.createdAt, documents.id);
}

export function findTrainTicketImport(
  database: DatabaseReader,
  tripId: string,
  segmentId: string,
  documentId: string,
) {
  return database
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.tripId, tripId),
        eq(documents.segmentId, segmentId),
        eq(documents.id, documentId),
        isNotNull(documents.importHash),
      ),
    )
    .limit(1);
}

export function findTrainTicketImportByHash(
  database: DatabaseReader,
  tripId: string,
  segmentId: string,
  hash: string,
) {
  return database
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.tripId, tripId),
        eq(documents.segmentId, segmentId),
        eq(documents.importHash, hash),
      ),
    )
    .limit(1);
}

export async function countTrainTicketImportItems(
  database: DatabaseReader,
  tripId: string,
  segmentId: string,
) {
  const [result] = await database
    .select({
      total: sql<number>`coalesce(sum(json_array_length(${documents.importItems})), 0)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tripId, tripId),
        eq(documents.segmentId, segmentId),
        isNotNull(documents.importHash),
      ),
    );
  return result?.total ?? 0;
}

export function listTravelerTrainTickets(
  database: DatabaseReader,
  tripId: string,
  userId: string,
  documentId?: string,
) {
  const assignments = schema.transportGroupAssignments;
  return database
    .select({
      id: sql<string>`CASE WHEN ${documents.importHash} IS NULL THEN ${documents.id} ELSE ${seats.id} END`,
      kind: segments.direction,
      originalName: sql<string>`CASE WHEN ${documents.importHash} IS NULL THEN ${documents.originalName} ELSE 'train-ticket.pdf' END`,
      size: sql<
        number | null
      >`CASE WHEN ${documents.importHash} IS NULL THEN ${documents.size} END`,
      createdAt: documents.createdAt,
      seatLabel: sql<
        string | null
      >`CASE WHEN ${seats.label} NOT LIKE 'import:%' THEN ${seats.label} END`,
      blobPath: documents.blobPath,
      segmentId: segments.id,
      allocation: seats.allocation,
      pageNumbers: seats.pageNumbers,
      imported: sql<number>`CASE WHEN ${documents.importHash} IS NULL THEN 0 ELSE 1 END`,
    })
    .from(seats)
    .innerJoin(
      documents,
      and(
        eq(documents.tripId, seats.tripId),
        eq(documents.segmentId, seats.segmentId),
        eq(documents.id, seats.documentId),
      ),
    )
    .innerJoin(
      segments,
      and(
        eq(segments.tripId, seats.tripId),
        eq(segments.id, seats.segmentId),
        eq(segments.mode, "train"),
      ),
    )
    .innerJoin(
      assignments,
      and(
        eq(assignments.tripId, seats.tripId),
        eq(assignments.userId, seats.userId),
        eq(assignments.groupId, segments.groupId),
      ),
    )
    .where(
      and(
        eq(seats.tripId, tripId),
        eq(seats.userId, userId),
        documentId
          ? or(
              and(isNull(documents.importHash), eq(documents.id, documentId)),
              and(isNotNull(documents.importHash), eq(seats.id, documentId)),
            )
          : undefined,
      ),
    )
    .orderBy(segments.direction, segments.position);
}
