import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import {
  findTrainSegment,
  listTrainPassengers,
  listTrainSeats,
  listTrainTicketDocuments,
  saveTrainSeatAssignments,
} from "../../datamodel/train-tickets.repository";
import * as schema from "../../schema";
import { batchRows } from "../../source-imports/batch-rows";
import type { DatabaseTransaction } from "../../source-imports/database.types";
import { planTrainSeats } from "./train-seat-allocation";

export async function getTrainTicketPool(
  database: AppDatabase,
  tripId: string,
  segmentId: string,
) {
  return database.transaction((transaction) =>
    previewPool(transaction, tripId, segmentId),
  );
}

async function previewPool(
  transaction: DatabaseTransaction,
  tripId: string,
  segmentId: string,
) {
  const segment = await findTrainSegment(transaction, tripId, segmentId);
  if (!segment) return null;
  const [seats, allPassengers, documents] = await Promise.all([
    listTrainSeats(transaction, tripId, segmentId),
    listTrainPassengers(transaction, tripId),
    listTrainTicketDocuments(transaction, tripId, segmentId),
  ]);
  const passengers = allPassengers.filter(
    (person) => person.groupId === segment.groupId,
  );
  const updates = planTrainSeats(seats, passengers, true);
  const updateById = new Map(updates.map((seat) => [seat.id, seat]));
  const passengersById = new Map(
    passengers.map((person) => [person.userId, person]),
  );
  const preview = seats.map((seat) => {
    const next = updateById.get(seat.id) ?? seat;
    const person = next.userId ? passengersById.get(next.userId) : undefined;
    return {
      id: seat.id,
      label: seat.label,
      assignedName: person ? `${person.firstName} ${person.lastName}` : null,
      roomNumber: person?.roomNumber ?? null,
      isNew: next.userId !== null && next.userId !== seat.userId,
    };
  });
  const unassigned =
    passengers.length -
    preview.filter((seat) => seat.assignedName !== null).length;
  const snapshot = createHash("sha256")
    .update(JSON.stringify({ seats, updates, preview, unassigned }))
    .digest("hex");
  return {
    view: {
      documents,
      seats: preview,
      snapshot,
      unassigned,
      hasChanges: updates.length > 0,
    },
    updates,
  };
}

export async function publishTrainTicketPool(
  database: AppDatabase,
  tripId: string,
  segmentId: string,
  snapshot: string,
  actorId: string,
) {
  return database.transaction(async (transaction) => {
    if (!(await canManageTrainTickets(transaction, tripId, actorId)))
      return "unavailable";
    const pool = await previewPool(transaction, tripId, segmentId);
    if (!pool || pool.view.snapshot !== snapshot) return "stale";
    if (pool.updates.length)
      await saveTrainSeatAssignments(transaction, tripId, pool.updates);
    return "published";
  });
}

export async function reconcileTrainTicketSeats(
  transaction: DatabaseTransaction,
  tripId: string,
) {
  const reserved = await listTrainSeats(transaction, tripId);
  if (!reserved.length) return;
  const passengers = await listTrainPassengers(transaction, tripId);
  const bySegment = new Map<string, typeof reserved>();
  for (const seat of reserved) {
    const segmentSeats = bySegment.get(seat.segmentId) ?? [];
    segmentSeats.push(seat);
    bySegment.set(seat.segmentId, segmentSeats);
  }
  const updates = [...bySegment.values()].flatMap((seats) =>
    planTrainSeats(
      seats,
      passengers.filter((person) => person.groupId === seats[0]?.groupId),
      false,
    ),
  );
  if (updates.length)
    await saveTrainSeatAssignments(transaction, tripId, updates);
}

export async function addTrainTicketDocument(
  transaction: DatabaseTransaction,
  input: {
    id: string;
    tripId: string;
    segmentId: string;
    blobPath: string;
    originalName: string;
    size: number;
    labels: string[];
  },
) {
  const { labels, ...document } = input;
  if (
    !(await findTrainSegment(transaction, document.tripId, document.segmentId))
  )
    throw new TrainTicketPoolError("train_segment_unavailable");
  const seats = await listTrainSeats(
    transaction,
    document.tripId,
    document.segmentId,
  );
  const existing = new Set(
    seats.map(({ label }) => normalizeTrainSeatLabel(label)),
  );
  if (labels.some((label) => existing.has(normalizeTrainSeatLabel(label))))
    throw new TrainTicketPoolError("duplicate_train_seat");
  if (seats.length + labels.length > 500)
    throw new TrainTicketPoolError("train_pool_capacity_reached");
  await transaction.insert(schema.trainTicketDocuments).values(document);
  const position = (seats.at(-1)?.position ?? -1) + 1;
  for (const batch of batchRows(
    labels.map((label, index) => ({
      id: randomUUID(),
      tripId: document.tripId,
      segmentId: document.segmentId,
      documentId: document.id,
      label,
      position: position + index,
    })),
  )) {
    await transaction.insert(schema.trainTicketSeats).values(batch);
  }
}

export async function removeTrainTicketDocument(
  database: AppDatabase,
  tripId: string,
  segmentId: string,
  documentId: string,
  actorId: string,
) {
  return database.transaction(async (transaction) => {
    if (!(await canManageTrainTickets(transaction, tripId, actorId)))
      return null;
    const documents = schema.trainTicketDocuments;
    const seats = schema.trainTicketSeats;
    const [document] = await transaction
      .delete(documents)
      .where(
        and(
          eq(documents.tripId, tripId),
          eq(documents.segmentId, segmentId),
          eq(documents.id, documentId),
        ),
      )
      .returning({ blobPath: documents.blobPath });
    if (!document) return null;
    await transaction
      .delete(seats)
      .where(
        and(
          eq(seats.tripId, tripId),
          eq(seats.segmentId, segmentId),
          eq(seats.documentId, documentId),
        ),
      );
    await transaction
      .insert(schema.pendingTicketBlobDeletions)
      .values(document)
      .onConflictDoNothing();
    return document.blobPath;
  });
}

export async function canManageTrainTickets(
  database: Pick<AppDatabase, "select">,
  tripId: string,
  userId: string,
) {
  const [membership] = await database
    .select({ role: schema.tripMemberships.role })
    .from(schema.tripMemberships)
    .where(
      and(
        eq(schema.tripMemberships.tripId, tripId),
        eq(schema.tripMemberships.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(membership && membership.role !== "traveler");
}

export function normalizeTrainSeatLabel(label: string) {
  return label.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export class TrainTicketPoolError extends Error {
  constructor(
    readonly code:
      | "train_segment_unavailable"
      | "duplicate_train_seat"
      | "train_pool_capacity_reached",
  ) {
    super(code);
  }
}
