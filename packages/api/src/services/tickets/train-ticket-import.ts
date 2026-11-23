import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { readTicketPdf } from "../../adapters/pdf/ticket-pdf.adapter";
import type { AppDatabase } from "../../auth";
import { createTrainTicketBlobPath } from "../../blob-path";
import {
  countTrainTicketImportItems,
  findTrainSegment,
  findTrainTicketImportByHash,
  listTrainPassengers,
  listTrainSeats,
  listTrainTicketImports,
} from "../../datamodel/train-tickets.repository";
import type { TicketBlobStorage } from "../../ports/ticket-storage";
import { trainTicketDocuments, trainTicketSeats } from "../../schema";
import { batchRows } from "../../source-imports/batch-rows";
import type { DatabaseTransaction } from "../../source-imports/database.types";
import { analyzeTrainTicket } from "./analyze-train-ticket";
import type { TrainTicketDecision } from "./train-ticket-import.types";
import {
  previewTrainTicketImport,
  trainImportSeatLabel,
} from "./train-ticket-import-preview";
import { canManageTrainTickets } from "./train-ticket-pool";
import { uploadPrivateTicket } from "./upload-private-ticket";

export type TrainTicketImportAccess = {
  database: AppDatabase;
  tripId: string;
  segmentId: string;
  actorId: string;
};

type ImportScope = Pick<TrainTicketImportAccess, "tripId" | "segmentId">;
const segmentLimit = 500;

export class TrainTicketImportError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "invalid_train_import_pdf"
      | "train_import_conflict"
      | "train_import_changed",
  ) {
    super(code);
  }
}

function journeyKey(
  segment: NonNullable<Awaited<ReturnType<typeof findTrainSegment>>>,
) {
  return JSON.stringify([
    segment.groupId,
    segment.direction,
    segment.origin,
    segment.destination,
    segment.departureAt,
    segment.serviceReference,
  ]);
}

async function loadPreview(
  transaction: DatabaseTransaction,
  { tripId, segmentId }: ImportScope,
) {
  const segment = await findTrainSegment(transaction, tripId, segmentId);
  if (!segment) throw new TrainTicketImportError("not_found");
  const [people, seats, documents] = await Promise.all([
    listTrainPassengers(transaction, tripId),
    listTrainSeats(transaction, tripId, segmentId),
    listTrainTicketImports(transaction, tripId, segmentId),
  ]);
  const passengers = people.filter(
    ({ groupId }) => groupId === segment.groupId,
  );
  const currentJourney = journeyKey(segment);
  const view = previewTrainTicketImport(
    passengers,
    seats,
    documents.map((document) => ({
      ...document,
      importItems: (document.importItems ?? []).map((item) =>
        document.importJourney === currentJourney || item.published
          ? item
          : { ...item, issue: "segmentMismatch" },
      ),
    })),
  );
  const snapshot = createHash("sha256")
    .update(JSON.stringify({ currentJourney, seats, passengers, documents }))
    .digest("hex");
  return { view: { ...view, snapshot }, seats, passengers, documents };
}

export function getTrainTicketImport(access: TrainTicketImportAccess) {
  return access.database.transaction(
    async (transaction) => (await loadPreview(transaction, access)).view,
  );
}

export async function uploadTrainTicketImport(
  access: TrainTicketImportAccess,
  storage: TicketBlobStorage,
  file: File,
) {
  const { database, tripId, segmentId, actorId } = access;
  const segment = await findTrainSegment(database, tripId, segmentId);
  if (!segment) throw new TrainTicketImportError("not_found");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const importHash = createHash("sha256").update(bytes).digest("hex");
  const [duplicate] = await findTrainTicketImportByHash(
    database,
    tripId,
    segmentId,
    importHash,
  );
  if (duplicate) return { documentId: duplicate.id, duplicate: true };

  const importJourney = journeyKey(segment);
  let candidates: ReturnType<typeof analyzeTrainTicket>;
  try {
    candidates = analyzeTrainTicket(await readTicketPdf(bytes), segment);
  } catch {
    throw new TrainTicketImportError("invalid_train_import_pdf");
  }
  if (!candidates.length)
    throw new TrainTicketImportError("invalid_train_import_pdf");
  const id = randomUUID();
  const blobPath = createTrainTicketBlobPath(tripId, id);
  const importItems = candidates.map((candidate) => ({
    ...candidate,
    id: randomUUID(),
  }));
  try {
    await uploadPrivateTicket(
      database,
      storage,
      blobPath,
      file,
      async (transaction) => {
        const current = await findTrainSegment(transaction, tripId, segmentId);
        if (
          !current ||
          !(await canManageTrainTickets(transaction, tripId, actorId))
        ) {
          throw new TrainTicketImportError("not_found");
        }
        if (journeyKey(current) !== importJourney) {
          throw new TrainTicketImportError("train_import_changed");
        }
        const totalItems =
          (await countTrainTicketImportItems(transaction, tripId, segmentId)) +
          importItems.length;
        if (totalItems > segmentLimit)
          throw new TrainTicketImportError("train_import_conflict");
        const [inserted] = await transaction
          .insert(trainTicketDocuments)
          .values({
            id,
            tripId,
            segmentId,
            blobPath,
            originalName:
              file.name.replace(/[\r\n\\/]/g, "_").slice(0, 180) ||
              "train-ticket.pdf",
            size: file.size,
            importHash,
            importJourney,
            importItems,
          })
          .onConflictDoNothing()
          .returning({ id: trainTicketDocuments.id });
        if (!inserted)
          throw new TrainTicketImportError("train_import_conflict");
      },
    );
  } catch (error) {
    if (
      error instanceof TrainTicketImportError &&
      error.code === "train_import_conflict"
    ) {
      const [existing] = await findTrainTicketImportByHash(
        database,
        tripId,
        segmentId,
        importHash,
      );
      if (existing) return { documentId: existing.id, duplicate: true };
    }
    throw error;
  }
  return { documentId: id, duplicate: false };
}

export async function getTrainImportItem(
  access: TrainTicketImportAccess,
  itemId: string,
) {
  const documents = await listTrainTicketImports(
    access.database,
    access.tripId,
    access.segmentId,
  );
  for (const document of documents) {
    const item = document.importItems?.find(({ id }) => id === itemId);
    if (item) return { document, item };
  }
  throw new TrainTicketImportError("not_found");
}

export function updateTrainImportItem(
  access: TrainTicketImportAccess,
  itemId: string,
  decision: TrainTicketDecision | { kind: "detected" },
) {
  const { database, tripId, segmentId, actorId } = access;
  return database.transaction(async (transaction) => {
    if (!(await canManageTrainTickets(transaction, tripId, actorId))) {
      throw new TrainTicketImportError("not_found");
    }
    if (decision.kind !== "detected" && decision.userIds?.length) {
      const segment = await findTrainSegment(transaction, tripId, segmentId);
      if (!segment) throw new TrainTicketImportError("not_found");
      const passengers = await listTrainPassengers(transaction, tripId);
      const eligible = new Set(
        passengers
          .filter(({ groupId }) => groupId === segment.groupId)
          .map(({ userId }) => userId),
      );
      if (!decision.userIds.every((id) => eligible.has(id))) {
        throw new TrainTicketImportError("train_import_conflict");
      }
    }
    const documents = await listTrainTicketImports(
      transaction,
      tripId,
      segmentId,
    );
    const document = documents.find(({ importItems }) =>
      importItems?.some(({ id }) => id === itemId),
    );
    if (!document?.importItems) throw new TrainTicketImportError("not_found");
    const importItems = document.importItems.map((item) => {
      if (item.id !== itemId) return item;
      if (item.published)
        throw new TrainTicketImportError("train_import_conflict");
      const { decision: previous, ...detected } = item;
      return decision.kind === "detected"
        ? detected
        : {
            ...detected,
            decision: {
              ...(previous?.kind === decision.kind ? previous : {}),
              ...decision,
            },
          };
    });
    await saveImportItems(transaction, access, document.id, importItems);
  });
}

export function publishTrainTicketImport(
  access: TrainTicketImportAccess,
  snapshot: string,
) {
  const { database, tripId, segmentId, actorId } = access;
  return database.transaction(async (transaction) => {
    if (!(await canManageTrainTickets(transaction, tripId, actorId))) {
      throw new TrainTicketImportError("not_found");
    }
    const { view, seats, passengers, documents } = await loadPreview(
      transaction,
      access,
    );
    if (view.snapshot !== snapshot)
      throw new TrainTicketImportError("train_import_changed");
    if (!view.coverage.ready) return;
    if (seats.length + view.coverage.ready > segmentLimit)
      throw new TrainTicketImportError("train_import_conflict");
    const rooms = new Map(
      passengers.map(({ userId, roomId }) => [userId, roomId]),
    );
    let position = (seats.at(-1)?.position ?? -1) + 1;
    const assignments: (typeof trainTicketSeats.$inferInsert)[] = [];
    for (const file of view.documents) {
      const ready = file.items.filter(({ status }) => status === "ready");
      if (!ready.length) continue;
      const source = documents.find(({ id }) => id === file.id);
      if (!source?.importItems)
        throw new TrainTicketImportError("train_import_changed");
      for (const item of ready) {
        const allocation =
          item.kind === "collective"
            ? "collective"
            : item.kind === "named"
              ? "named"
              : "pool";
        for (const [index, userId] of item.userIds.entries()) {
          assignments.push({
            id: randomUUID(),
            tripId,
            segmentId,
            documentId: file.id,
            importItemId: item.id,
            allocation,
            pageNumbers: allocation === "collective" ? null : item.pages,
            label:
              (allocation !== "collective" &&
                trainImportSeatLabel(item.carriage, item.seat)) ||
              `import:${item.id}:${index}`,
            position: position++,
            userId,
            roomId: allocation === "named" ? null : (rooms.get(userId) ?? null),
          });
        }
      }
      const publishedItems = new Set(ready.map(({ id }) => id));
      await saveImportItems(
        transaction,
        access,
        file.id,
        source.importItems.map((item) =>
          publishedItems.has(item.id) ? { ...item, published: true } : item,
        ),
      );
    }
    for (const batch of batchRows(assignments)) {
      await transaction.insert(trainTicketSeats).values(batch);
    }
  });
}

function saveImportItems(
  transaction: DatabaseTransaction,
  { tripId, segmentId }: ImportScope,
  documentId: string,
  importItems: NonNullable<
    typeof trainTicketDocuments.$inferInsert.importItems
  >,
) {
  return transaction
    .update(trainTicketDocuments)
    .set({ importItems })
    .where(
      and(
        eq(trainTicketDocuments.tripId, tripId),
        eq(trainTicketDocuments.segmentId, segmentId),
        eq(trainTicketDocuments.id, documentId),
      ),
    );
}
