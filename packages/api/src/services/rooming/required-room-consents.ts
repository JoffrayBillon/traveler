import type { RoomMove } from "./model";

export function getRequiredRoomConsents(
  moves: readonly RoomMove[],
  affectedRoomIds: Iterable<string>,
  projectedRoomByUser: ReadonlyMap<string, string>,
  genderByUser: ReadonlyMap<string, "M" | "F" | null>,
  roomById: ReadonlyMap<string, { genderPolicy: string }>,
) {
  const required = new Set(moves.map(({ userId }) => userId));
  const vacancy = moves.length === 1 ? moves[0] : undefined;
  for (const roomId of vacancy ? [vacancy.targetRoomId] : affectedRoomIds) {
    const occupants = [...projectedRoomByUser]
      .filter(([, assignedRoomId]) => assignedRoomId === roomId)
      .map(([userId]) => userId);
    const genders = new Set(
      occupants.map((userId) => genderByUser.get(userId) ?? null),
    );
    if (
      occupants.length > 1 &&
      (genders.size > 1 ||
        genders.has(null) ||
        (vacancy && roomById.get(roomId)?.genderPolicy === "mixed"))
    ) {
      for (const occupant of occupants) required.add(occupant);
    }
  }
  return [...required].sort();
}
