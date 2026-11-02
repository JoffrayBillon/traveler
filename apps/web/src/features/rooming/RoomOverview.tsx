import { useRoomingMutations } from "@traveler/api/rooming/mutations";
import type { RoomSummary } from "@traveler/api/rooming/rooming.types";
import { Button, Card } from "@traveler/components/ui";
import { type DragEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { roomErrorLabel } from "./rooming-errors";

export function RoomOverview({
  tripId,
  rooms,
  ownRoom,
  userId,
  isStaff,
  onMessage,
}: {
  tripId: string;
  rooms: RoomSummary[];
  ownRoom: RoomSummary | undefined;
  userId: string;
  isStaff: boolean;
  onMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const mutations = useRoomingMutations(tripId);
  const [draggedOccupant, setDraggedOccupant] = useState<{
    userId: string;
    roomId: string;
  } | null>(null);

  async function toggleLock(room: RoomSummary) {
    try {
      await mutations.setRoomLock.mutateAsync({
        roomId: room.id,
        locked: !room.isLocked,
      });
      onMessage(room.isLocked ? t("roomUnlocked") : t("roomLocked"));
    } catch {
      onMessage(t("roomLockCouldNotBeChanged"));
    }
  }

  function handleDragStart(
    event: DragEvent<HTMLLIElement>,
    occupant: { userId: string },
    roomId: string,
  ) {
    setDraggedOccupant({ userId: occupant.userId, roomId });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", occupant.userId);
  }

  async function handleDrop(event: DragEvent<HTMLElement>, roomId: string) {
    event.preventDefault();
    const moved = draggedOccupant;
    setDraggedOccupant(null);
    if (!moved || moved.roomId === roomId) return;
    if (!isStaff) {
      try {
        await mutations.createRequest.mutateAsync({
          moves: [
            {
              userId: moved.userId,
              expectedRoomId: moved.roomId,
              targetRoomId: roomId,
            },
          ],
        });
        onMessage(t("yourRoomRequestHasBeenRecorded"));
      } catch (error) {
        const code = (error as { code?: string }).code;
        onMessage(
          t(roomErrorLabel[code ?? ""] ?? "roomAssignmentsCouldNotBeUpdated"),
        );
      }
      return;
    }
    try {
      await mutations.moveTraveler.mutateAsync({
        roomId,
        userId: moved.userId,
        expectedRoomId: moved.roomId,
      });
      onMessage(t("roomAssignmentsHaveBeenUpdated"));
    } catch (error) {
      const code = (error as { code?: string }).code;
      onMessage(
        t(roomErrorLabel[code ?? ""] ?? "roomAssignmentsCouldNotBeUpdated"),
      );
    }
  }
  return (
    <>
      {ownRoom ? (
        <Card as="article" spacing="compact" arrangement="stack">
          <div className="grid gap-2">
            <span className="text-xs text-content-subtle">{t("yourRoom")}</span>
            <strong className="text-lg">{ownRoom.name}</strong>
          </div>
          <span className="inline-block rounded-full border border-border px-3 py-2 text-xs font-semibold text-content-muted">
            {t("occupiedCapacityBeds", {
              occupied: ownRoom.occupiedCount,
              capacity: ownRoom.capacity,
            })}
          </span>
          <Button
            appearance="quiet"
            onPress={() => void toggleLock(ownRoom)}
            isDisabled={mutations.setRoomLock.isPending}
          >
            {ownRoom.isLocked ? t("unlockRoom") : t("lockRoom")}
          </Button>
          <ul className="list-inside list-disc space-y-1 leading-relaxed text-content-muted">
            {ownRoom.occupants.map((person) => (
              <li
                key={person.userId}
                draggable={person.userId === userId}
                onDragStart={(event) =>
                  handleDragStart(event, person, ownRoom.id)
                }
                onDragEnd={() => setDraggedOccupant(null)}
                className={
                  person.userId === userId
                    ? "cursor-grab active:cursor-grabbing"
                    : undefined
                }
              >
                {person.firstName} {person.lastName}
                {person.userId === userId ? ` · ${t("you")}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
          {t("youHaveNotBeenAssignedARoomYet")}
        </p>
      )}
      {isStaff && (
        <div className="grid gap-3">
          <h4 className="text-base font-bold">{t("currentRoomAssignments")}</h4>
          {rooms.map((room) => (
            <Card
              as="article"
              spacing="compact"
              arrangement="stack"
              key={room.id}
              onDragOver={
                isStaff
                  ? (event: DragEvent<HTMLElement>) => event.preventDefault()
                  : undefined
              }
              onDrop={
                isStaff
                  ? (event: DragEvent<HTMLElement>) =>
                      void handleDrop(event, room.id)
                  : undefined
              }
              {...(isStaff && draggedOccupant?.roomId !== room.id
                ? { className: "transition-colors hover:border-accent" }
                : {})}
            >
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-lg">{room.name}</strong>
                  <span
                    role="img"
                    aria-label={
                      room.genderPolicy === "mixed"
                        ? t("mixedRoomCode")
                        : room.occupants[0]?.gender === "M"
                          ? t("maleRoomCode")
                          : room.occupants[0]?.gender === "F"
                            ? t("femaleRoomCode")
                            : t("roomCompositionNotSet")
                    }
                    className={`inline-flex size-8 items-center justify-center rounded-full text-xs font-bold ${room.genderPolicy === "mixed" ? "bg-[color-mix(in_srgb,var(--theme-color-warning),transparent_88%)] text-warning" : "bg-[color-mix(in_srgb,var(--theme-color-success),transparent_88%)] text-success"}`}
                  >
                    {room.genderPolicy === "mixed"
                      ? "M"
                      : room.occupants[0]?.gender === "M"
                        ? "H"
                        : room.occupants[0]?.gender === "F"
                          ? "F"
                          : "—"}
                  </span>
                </div>
                <span className="text-xs text-content-subtle">
                  {t("occupiedCapacityBeds", {
                    occupied: room.occupiedCount,
                    capacity: room.capacity,
                  })}
                  {room.genderPolicy === "mixed"
                    ? ` · ${t("approvedMixedRoom")}`
                    : ""}
                </span>
              </div>
              <Button
                appearance="quiet"
                onPress={() => void toggleLock(room)}
                isDisabled={mutations.setRoomLock.isPending}
              >
                {room.isLocked ? t("unlockRoom") : t("lockRoom")}
              </Button>
              {room.occupants.length ? (
                <ul className="list-inside list-disc space-y-1 leading-relaxed text-content-muted">
                  {room.occupants.map((person) => (
                    <li
                      key={person.userId}
                      draggable={isStaff || person.userId === userId}
                      onDragStart={(event) =>
                        handleDragStart(event, person, room.id)
                      }
                      onDragEnd={() => setDraggedOccupant(null)}
                      className={
                        isStaff
                          ? "cursor-grab active:cursor-grabbing"
                          : undefined
                      }
                    >
                      {person.firstName} {person.lastName}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-content-subtle">{t("emptyRoom")}</p>
              )}
            </Card>
          ))}
        </div>
      )}
      {!isStaff && rooms.length > 0 && (
        <section
          className="grid gap-3"
          aria-labelledby="available-room-targets"
        >
          <h4 className="text-base font-bold" id="available-room-targets">
            {t("availableRoomTargets")}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms
              .filter(
                (room) =>
                  room.id !== ownRoom?.id &&
                  !room.isLocked &&
                  room.occupiedCount < room.capacity,
              )
              .map((room) => (
                <Card
                  as="article"
                  spacing="compact"
                  arrangement="stack"
                  key={room.id}
                  onDragOver={(event: DragEvent<HTMLElement>) =>
                    event.preventDefault()
                  }
                  onDrop={(event: DragEvent<HTMLElement>) =>
                    void handleDrop(event, room.id)
                  }
                  {...(draggedOccupant
                    ? { className: "border-accent bg-surface-raised" }
                    : {})}
                >
                  <strong className="text-lg">{room.name}</strong>
                  <span className="text-sm text-content-muted">
                    {t("roomCountBedSAvailable", {
                      room: t("occupiedCapacityBeds", {
                        occupied: room.occupiedCount,
                        capacity: room.capacity,
                      }),
                      count: room.capacity - room.occupiedCount,
                    })}
                  </span>
                </Card>
              ))}
          </div>
        </section>
      )}
    </>
  );
}
