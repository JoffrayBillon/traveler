import { normalizePersonName } from "../../source-import/shared";
import { planTrainSeats, type TrainPassenger } from "./train-seat-allocation";
import type {
  TrainTicketImportDocument,
  TrainTicketImportIssue,
  TrainTicketImportItem,
} from "./train-ticket-import.types";
import { normalizeTrainSeatLabel } from "./train-ticket-pool";

type AllocatedSeat = {
  userId: string | null;
  label: string;
  importItemId: string | null;
};
type ItemStatus = "ready" | "review" | "published" | "ignored";
type ImportPreviewItem = Omit<
  TrainTicketImportItem,
  "decision" | "published" | "issue"
> & {
  status: ItemStatus;
  issue: TrainTicketImportIssue;
  userIds: string[];
};

const seatOrder = new Intl.Collator("fr", { numeric: true });

export function trainImportSeatLabel(
  carriage: string | null,
  seat: string | null,
) {
  return carriage && seat
    ? `Voiture ${carriage.toUpperCase()} · Place ${seat.toUpperCase()}`
    : null;
}

export function previewTrainTicketImport(
  passengers: readonly TrainPassenger[],
  seats: readonly AllocatedSeat[],
  documents: readonly TrainTicketImportDocument[],
) {
  const eligible = new Set(passengers.map(({ userId }) => userId));
  const published = new Set<string>();
  const publishedByItem = new Map<string, string[]>();
  for (const seat of seats) {
    if (!seat.userId || !eligible.has(seat.userId)) continue;
    published.add(seat.userId);
    if (!seat.importItemId) continue;
    const users = publishedByItem.get(seat.importItemId) ?? [];
    users.push(seat.userId);
    publishedByItem.set(seat.importItemId, users);
  }

  const byName = new Map<string, string[]>();
  for (const person of passengers) {
    const key = travelerNameKey(person.firstName, person.lastName);
    const users = byName.get(key) ?? [];
    users.push(person.userId);
    byName.set(key, users);
  }

  const claimed = new Set(published);
  const numbers = new Set<string>();
  const labels = new Set(
    seats.map(({ label }) => normalizeTrainSeatLabel(label)),
  );
  const files = documents.map((document) => ({
    id: document.id,
    name: document.originalName,
    items: document.importItems.map<ImportPreviewItem>(
      ({ decision, published: isPublished, ...detected }) => {
        const kind =
          decision && decision.kind !== "ignored"
            ? decision.kind
            : detected.kind;
        let status: ItemStatus = "review";
        if (isPublished) status = "published";
        else if (decision?.kind === "ignored" || kind === "auxiliary")
          status = "ignored";
        const blocked =
          detected.issue === "segmentMismatch" ||
          detected.issue === "multipleTickets";
        const issue: TrainTicketImportIssue =
          blocked || !decision ? detected.issue : null;
        return {
          ...detected,
          kind,
          firstName: kind === "named" ? detected.firstName : null,
          lastName: kind === "named" ? detected.lastName : null,
          carriage: decision?.carriage ?? detected.carriage,
          seat: decision?.seat ?? detected.seat,
          capacity: decision?.capacity ?? detected.capacity,
          ticketNumber: decision?.ticketNumber ?? detected.ticketNumber,
          status,
          issue,
          userIds: isPublished ? (publishedByItem.get(detected.id) ?? []) : [],
        };
      },
    ),
  }));
  const items = files.flatMap((file) => file.items);
  for (const item of items) {
    if (
      item.status === "published" &&
      item.ticketNumber &&
      (item.kind !== "named" || publishedByItem.has(item.id))
    ) {
      numbers.add(item.ticketNumber.toUpperCase());
    }
  }
  const available = items.filter((item) => {
    if (item.status !== "review" || item.issue) return false;
    const number = item.ticketNumber?.toUpperCase();
    const label = trainImportSeatLabel(item.carriage, item.seat);
    const seatKey = label ? normalizeTrainSeatLabel(label) : null;
    if ((number && numbers.has(number)) || (seatKey && labels.has(seatKey))) {
      item.issue = "duplicateTicket";
      return false;
    }
    if (number) numbers.add(number);
    if (seatKey) labels.add(seatKey);
    return true;
  });

  const decisions = new Map(
    documents.flatMap(({ importItems }) =>
      importItems.map(({ id, decision }) => [id, decision] as const),
    ),
  );
  for (const item of available) {
    const decision = decisions.get(item.id);
    if (item.kind === "named") {
      const matches =
        item.firstName && item.lastName
          ? byName.get(travelerNameKey(item.firstName, item.lastName))
          : undefined;
      const userIds =
        decision?.userIds ?? (matches?.length === 1 ? matches : []);
      if (
        userIds.length !== 1 ||
        !userIds.every((id) => eligible.has(id) && !claimed.has(id))
      ) {
        item.issue = "travelerUnavailable";
        continue;
      }
      item.userIds = userIds;
    } else if (item.kind === "collective") {
      const userIds = decision?.userIds ?? [];
      if (!item.capacity || !userIds.length || userIds.length > item.capacity) {
        item.issue = "collectiveUnconfirmed";
        continue;
      }
      if (!userIds.every((id) => eligible.has(id) && !claimed.has(id))) {
        item.issue = "travelerUnavailable";
        continue;
      }
      item.userIds = userIds;
    } else {
      continue;
    }
    for (const id of item.userIds) claimed.add(id);
    item.status = "ready";
  }

  const transferable = available
    .filter((item) => {
      if (item.kind !== "transferable") return false;
      if (trainImportSeatLabel(item.carriage, item.seat)) return true;
      item.issue = "unrecognized";
      return false;
    })
    .sort(
      (a, b) =>
        seatOrder.compare(a.carriage ?? "", b.carriage ?? "") ||
        seatOrder.compare(a.seat ?? "", b.seat ?? ""),
    );
  const proposed = planTrainSeats(
    transferable.map(({ id }) => ({ id, roomId: null, userId: null })),
    passengers.filter(({ userId }) => !claimed.has(userId)),
    true,
  );
  const proposedById = new Map(proposed.map(({ id, userId }) => [id, userId]));
  for (const item of transferable) {
    const userId = proposedById.get(item.id);
    if (!userId) {
      item.issue = "unassigned";
      continue;
    }
    item.status = "ready";
    item.userIds = [userId];
    claimed.add(userId);
  }

  return {
    documents: files,
    coverage: {
      expected: passengers.length,
      published: published.size,
      ready: claimed.size - published.size,
      missing: passengers
        .filter(({ userId }) => !claimed.has(userId))
        .map(nameTraveler),
    },
    travelers: passengers.map(nameTraveler),
  };
}

function nameTraveler(person: TrainPassenger) {
  return { id: person.userId, name: `${person.firstName} ${person.lastName}` };
}

function travelerNameKey(firstName: string, lastName: string) {
  return normalizePersonName(
    firstName.replace(/[-'’]/g, " "),
    lastName.replace(/[-'’]/g, " "),
  );
}
