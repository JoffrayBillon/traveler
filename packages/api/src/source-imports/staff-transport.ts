import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { normalizeTransportCity } from "../datamodel/transport.repository";
import * as schema from "../schema";
import type { StaffImportRow } from "../source-import/types";
import { batchRows } from "./batch-rows";
import type { DatabaseExecutor, DatabaseTransaction } from "./database.types";
import { InvalidStaffTransportMappingError } from "./errors";

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
  rows: StaffImportRow[],
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
    const match = candidates.length === 1 ? candidates[0] : null;
    transportRows.push({
      normalizedCity,
      sourceCity: source.sourceCity,
      participantCount: source.count,
      action:
        candidates.length === 0
          ? "create_draft"
          : candidates.length === 1
            ? "matched"
            : "choose_group",
      groupId: match?.id ?? null,
      groupName: match?.name ?? null,
      candidates,
    });
  }
  return { rows: transportRows };
}

export async function resolveStaffTransportGroups(
  transaction: DatabaseTransaction,
  tripId: string,
  rows: StaffImportRow[],
  transportMappings: Record<string, string>,
  now: Date,
) {
  const cities = new Map<string, string>();
  for (const row of rows) {
    if (row.transportMode === "none") continue;
    if (!row.departureCity) throw new InvalidStaffTransportMappingError();
    const normalizedCity = normalizeTransportCity(row.departureCity);
    if (!cities.has(normalizedCity))
      cities.set(normalizedCity, row.departureCity.trim());
  }
  const existingGroups = cities.size
    ? await transaction
        .select({
          id: schema.transportGroups.id,
          name: schema.transportGroups.name,
          normalizedCity: schema.transportGroups.normalizedCity,
        })
        .from(schema.transportGroups)
        .where(eq(schema.transportGroups.tripId, tripId))
    : [];
  const validMappingKeys = new Set<string>();
  const groupIdByCity = new Map<string, string>();
  for (const [normalizedCity, sourceCity] of cities) {
    const matches = existingGroups.filter(
      (group) => group.normalizedCity === normalizedCity,
    );
    if (matches.length === 1) {
      groupIdByCity.set(normalizedCity, matches[0]?.id ?? "");
      continue;
    }
    if (matches.length > 1) {
      const selectedGroupId = transportMappings[normalizedCity];
      if (
        !selectedGroupId ||
        !matches.some((group) => group.id === selectedGroupId)
      )
        throw new InvalidStaffTransportMappingError();
      validMappingKeys.add(normalizedCity);
      groupIdByCity.set(normalizedCity, selectedGroupId);
      continue;
    }
    if (transportMappings[normalizedCity])
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
  if (Object.keys(transportMappings).some((key) => !validMappingKeys.has(key)))
    throw new InvalidStaffTransportMappingError();
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
