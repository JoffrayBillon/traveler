type SeatAssignment = {
  id: string;
  roomId: string | null;
  userId: string | null;
  allocation?: "pool" | "named" | "collective";
};

export type TrainPassenger = {
  userId: string;
  roomId: string | null;
  roomNumber: string | null;
  firstName: string;
  lastName: string;
};

const roomOrder = new Intl.Collator("fr", { numeric: true });

// The seat list is already ordered as supplied by the organizer.
export function planTrainSeats(
  seats: readonly SeatAssignment[],
  passengers: readonly TrainPassenger[],
  distribute: boolean,
) {
  const passengerById = new Map(
    passengers.map((person) => [person.userId, person]),
  );
  const assigned = new Set(
    seats.flatMap(({ userId }) =>
      userId && passengerById.has(userId) ? [userId] : [],
    ),
  );
  const unassigned = passengers
    .filter((person) => person.roomId !== null && !assigned.has(person.userId))
    .sort(
      (left, right) =>
        roomOrder.compare(left.roomNumber ?? "", right.roomNumber ?? "") ||
        roomOrder.compare(left.lastName, right.lastName) ||
        roomOrder.compare(left.firstName, right.firstName) ||
        left.userId.localeCompare(right.userId),
    );

  const planned = seats.map((seat) => {
    const occupant = seat.userId ? passengerById.get(seat.userId) : undefined;
    if (seat.allocation === "named") {
      return { ...seat, userId: occupant?.userId ?? null, roomId: null };
    }
    if (occupant) return { ...seat, roomId: occupant.roomId ?? seat.roomId };
    const replacement = seat.roomId
      ? unassigned.find(
          (person) =>
            person.roomId === seat.roomId && !assigned.has(person.userId),
        )
      : undefined;
    if (replacement) assigned.add(replacement.userId);
    return { ...seat, userId: replacement?.userId ?? null };
  });

  if (distribute) {
    const remaining = unassigned.filter(
      (person) => !assigned.has(person.userId),
    );
    for (const seat of planned) {
      if (
        seat.allocation === "named" ||
        seat.allocation === "collective" ||
        seat.userId ||
        seat.roomId
      )
        continue;
      const passenger = remaining.shift();
      if (!passenger) break;
      seat.userId = passenger.userId;
      seat.roomId = passenger.roomId;
    }
  }

  return planned.filter(
    (seat, index) =>
      seat.userId !== seats[index]?.userId ||
      seat.roomId !== seats[index]?.roomId,
  );
}
