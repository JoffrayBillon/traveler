import { z } from "zod";
import type { AppDatabase } from "../../auth";
import {
  deleteTransportGroup,
  saveCarpoolRole,
  saveTransportGroup,
  setParticipantTransportInTransaction,
} from "../../datamodel/transport.repository";
import { transportSegmentModes } from "../../schema";
import { reconcileTrainTicketSeats } from "../tickets/train-ticket-pool";

const optionalLine = z
  .string()
  .trim()
  .max(200)
  .transform((value) => value || null)
  .nullable();

const segmentSchema = z.object({
  id: z.string().uuid().optional(),
  direction: z.enum(["outbound", "return"]),
  mode: z.enum(transportSegmentModes),
  origin: z.string().trim().min(1).max(120),
  destination: z.string().trim().min(1).max(120),
  departureAt: optionalLine,
  arrivalAt: optionalLine,
  serviceReference: optionalLine,
  instructions: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null)
    .nullable()
    .optional(),
});

const groupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sourceCity: z.string().trim().min(1).max(120),
  outboundMeetingAt: optionalLine,
  outboundMeetingPlace: optionalLine,
  returnMeetingAt: optionalLine,
  returnMeetingPlace: optionalLine,
  segments: z.array(segmentSchema).max(12),
});

export async function saveTransportGroupService(
  database: AppDatabase,
  tripId: string,
  payload: unknown,
  groupId?: string,
) {
  const parsed = groupSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: "invalid_group" };
  const segmentIds = parsed.data.segments.flatMap((segment) =>
    segment.id ? [segment.id] : [],
  );
  if (new Set(segmentIds).size !== segmentIds.length)
    return { ok: false as const, error: "invalid_segment" };
  const result = await saveTransportGroup(
    database,
    tripId,
    {
      ...parsed.data,
      segments: parsed.data.segments.map(
        ({ id, instructions, ...segment }) => ({
          ...segment,
          ...(id ? { id } : {}),
          ...(instructions === undefined ? {} : { instructions }),
        }),
      ),
    },
    groupId,
  );
  if ("error" in result) return { ok: false as const, error: result.error };
  return { ok: true as const, group: result.group };
}

export async function setParticipantTransportService(
  database: AppDatabase,
  tripId: string,
  userId: string,
  actorUserId: string,
  payload: unknown,
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return { error: "invalid_transport_assignment" as const };
  const input = payload as Record<string, unknown>;
  if (
    input.choice !== "group" &&
    input.choice !== "none" &&
    input.choice !== "unconfirmed"
  )
    return { error: "invalid_transport_assignment" as const };
  if (
    input.groupId !== undefined &&
    input.groupId !== null &&
    typeof input.groupId !== "string"
  )
    return { error: "invalid_transport_assignment" as const };
  const choice = input.choice;
  const groupId = typeof input.groupId === "string" ? input.groupId : null;
  return database.transaction(async (transaction) => {
    const result = await setParticipantTransportInTransaction(
      transaction,
      tripId,
      userId,
      choice,
      groupId,
      actorUserId,
    );
    if (!("error" in result))
      await reconcileTrainTicketSeats(transaction, tripId);
    return result;
  });
}

export async function saveCarpoolRoleService(
  database: AppDatabase,
  tripId: string,
  userId: string,
  payload: unknown,
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return { error: "invalid_carpool_role" as const };
  const input = payload as Record<string, unknown>;
  if (
    input.role !== "none" &&
    input.role !== "driver" &&
    input.role !== "passenger"
  )
    return { error: "invalid_carpool_role" as const };
  if (
    input.driverUserId !== undefined &&
    input.driverUserId !== null &&
    typeof input.driverUserId !== "string"
  )
    return { error: "invalid_carpool_role" as const };
  return saveCarpoolRole(
    database,
    tripId,
    userId,
    input.role,
    typeof input.driverUserId === "string" ? input.driverUserId : null,
  );
}

export function deleteTransportGroupService(
  database: AppDatabase,
  tripId: string,
  groupId: string,
) {
  return deleteTransportGroup(database, tripId, groupId);
}
