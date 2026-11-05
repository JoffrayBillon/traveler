import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { normalizeTransportCity } from "../datamodel/transport.repository";
import * as schema from "../schema";
import { batchRows } from "./batch-rows";
import type { DatabaseExecutor, DatabaseTransaction } from "./database.types";
import { InvalidStaffTransportMappingError } from "./errors";

type SourceTransport = {
  transportMode: "train" | "none";
  departureCity: string | null;
};

export type StaffTransportPreviewRow = {
  normalizedCity: string;
  sourceCity: string;
  participantCount: number;
  action: "matched" | "create_draft" | "choose_group";
  groupId: string | null;
  groupName: string | null;
  candidates: { id: string; name: string }[];
};

export type StaffGroupAssignment =
  typeof schema.transportGroupAssignments.$inferInsert;

export async function previewStaffTransportImport(
  database: DatabaseExecutor,
  tripId: string,
  rows: SourceTransport[],
  savedMappings?: ReadonlyMap<string, string>,
) {
  const participantsByCity = new Map<
    string,
    { sourceCity: string; count: number }
  >();
  for (const row of rows) {
    if (row.transportMode === "none") continue;
    if (!row.departureCity) throw new InvalidStaffTransportMappingError();
    const normalizedCity = normalizeTransportCity(row.departureCity);
    const current = participantsByCity.get(normalizedCity);
    participantsByCity.set(normalizedCity, {
      sourceCity: current?.sourceCity ?? row.departureCity.trim(),
      count: (current?.count ?? 0) + 1,
    });
  }
  const groups = participantsByCity.size
    ? await database
        .select({
          id: schema.transportGroups.id,
          name: schema.transportGroups.name,
          normalizedCity: schema.transportGroups.normalizedCity,
        })
        .from(schema.transportGroups)
        .where(eq(schema.transportGroups.tripId, tripId))
    : [];
  const transportRows: StaffTransportPreviewRow[] = [];
  for (const [normalizedCity, source] of participantsByCity) {
    const candidates = groups
      .filter((group) => group.normalizedCity === normalizedCity)
      .map(({ id, name }) => ({ id, name }));
    const savedId = savedMappings?.get(normalizedCity);
    const match =
      groups.find((group) => group.id === savedId) ??
      (candidates.length === 1 ? candidates[0] : null);
    transportRows.push({
      normalizedCity,
      sourceCity: source.sourceCity,
      participantCount: source.count,
      action: match
        ? "matched"
        : candidates.length
          ? "choose_group"
          : "create_draft",
      groupId: match?.id ?? null,
      groupName: match?.name ?? null,
      candidates: savedMappings
        ? groups.map(({ id, name }) => ({ id, name }))
        : candidates,
    });
  }
  return { rows: transportRows };
}

export async function resolveStaffTransportGroups(
  transaction: DatabaseTransaction,
  tripId: string,
  rows: SourceTransport[],
  transportMappings: Record<string, string>,
  now: Date,
  savedMappings?: ReadonlyMap<string, string>,
) {
  const { rows: options } = await previewStaffTransportImport(
    transaction,
    tripId,
    rows,
    savedMappings,
  );
  const remaining = new Set(Object.keys(transportMappings));
  const groupIdByCity = new Map<string, string>();
  for (const {
    normalizedCity,
    sourceCity,
    action,
    groupId: suggestedId,
    candidates,
  } of options) {
    const selectedId = remaining.delete(normalizedCity)
      ? transportMappings[normalizedCity]
      : undefined;
    if (selectedId !== undefined) {
      if (
        (!savedMappings && action !== "choose_group") ||
        !candidates.some(({ id }) => id === selectedId)
      )
        throw new InvalidStaffTransportMappingError();
      groupIdByCity.set(normalizedCity, selectedId);
      continue;
    }
    if (suggestedId) {
      groupIdByCity.set(normalizedCity, suggestedId);
      continue;
    }
    if (action === "choose_group")
      throw new InvalidStaffTransportMappingError();
    const groupId = randomUUID();
    await transaction.insert(schema.transportGroups).values({
      id: groupId,
      tripId,
      name: sourceCity,
      sourceCity,
      normalizedCity,
      isDraft: true,
      outboundMeetingAt: null,
      outboundMeetingPlace: null,
      returnMeetingAt: null,
      returnMeetingPlace: null,
      createdAt: now,
      updatedAt: now,
    });
    groupIdByCity.set(normalizedCity, groupId);
  }
  if (remaining.size) throw new InvalidStaffTransportMappingError();
  return groupIdByCity;
}

export async function replaceStaffTransportAssignments(
  transaction: DatabaseTransaction,
  tripId: string,
  affectedUserIds: string[],
  groupedUserIds: string[],
  assignments: StaffGroupAssignment[],
  now: Date,
) {
  if (groupedUserIds.length) {
    await transaction
      .update(schema.travelerDetails)
      .set({
        carpoolRole: "undecided",
        carpoolDriverUserId: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.travelerDetails.tripId, tripId),
          eq(schema.travelerDetails.carpoolRole, "passenger"),
          inArray(schema.travelerDetails.carpoolDriverUserId, groupedUserIds),
        ),
      );
  }
  if (affectedUserIds.length) {
    await transaction
      .delete(schema.transportGroupAssignments)
      .where(
        and(
          eq(schema.transportGroupAssignments.tripId, tripId),
          inArray(schema.transportGroupAssignments.userId, affectedUserIds),
        ),
      );
  }
  for (const batch of batchRows(assignments))
    await transaction.insert(schema.transportGroupAssignments).values(batch);
}
