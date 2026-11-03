import type { StaffTraveler } from "@traveler/api/participants/participant.types";
import { useRoomingMutations } from "@traveler/api/rooming/mutations";
import type { RoomSummary } from "@traveler/api/rooming/rooming.types";
import { Button, Card } from "@traveler/components/ui";
import { Lock, LockOpen } from "lucide-react";
import { type DragEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { roomErrorLabel } from "./rooming-errors";

const UNASSIGNED_DROP_TARGET_ID = "__unassigned_drop_target__";

export function RoomOverview({
  tripId,
  rooms,
  travelers,
  ownRoom,
  userId,
  isStaff,
  onMessage,
}: {
  tripId: string;
  rooms: RoomSummary[];
  travelers: StaffTraveler[];
  ownRoom: RoomSummary | undefined;
  userId: string;
  isStaff: boolean;
  onMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const mutations = useRoomingMutations(tripId);
  const [draggedOccupant, setDraggedOccupant] = useState<{
    userId: string;
    roomId: string | null;
  } | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  function clearDragState() {
    setDraggedOccupant(null);
    setDragOverTargetId(null);
  }

  async function toggleLock(room: RoomSummary) {
    try {
      await mutations.setRoomLock.mutateAsync({
        roomId: room.id,
        locked: !room.isLocked,
      });
      onMessage(room.isLocked ? t("roomUnlocked") : t("roomLocked"));
    } catch (error) {
      const code = (error as { code?: string }).code;
      onMessage(t(roomErrorLabel[code ?? ""] ?? "roomLockCouldNotBeChanged"));
    }
  }

  function handleDragStart(
    event: DragEvent<HTMLLIElement>,
    occupant: { userId: string },
    roomId: string | null,
  ) {
    setDraggedOccupant({ userId: occupant.userId, roomId });
    setDragOverTargetId(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", occupant.userId);
  }

  function handleRoomDragOver(
    event: DragEvent<HTMLElement>,
    roomId: string,
    capacity: number,
    occupiedCount: number,
  ) {
    if (
      !draggedOccupant ||
      draggedOccupant.roomId === roomId ||
      occupiedCount >= capacity
    )
      return;
    event.preventDefault();
    setDragOverTargetId(roomId);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>, targetId: string) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget))
      return;
    setDragOverTargetId((current) => (current === targetId ? null : current));
  }

  async function handleDrop(event: DragEvent<HTMLElement>, roomId: string) {
    event.preventDefault();
    const moved = draggedOccupant;
    clearDragState();
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

  async function handleDropOnUnassigned(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const moved = draggedOccupant;
    clearDragState();
    if (!moved?.roomId || !isStaff) return;
    try {
      await mutations.unassignTraveler.mutateAsync({
        roomId: moved.roomId,
        userId: moved.userId,
      });
      onMessage(t("travelerRemovedFromRoom"));
    } catch (error) {
      const code = (error as { code?: string }).code;
      onMessage(
        t(roomErrorLabel[code ?? ""] ?? "roomAssignmentsCouldNotBeUpdated"),
      );
    }
  }
  const assignedUserIds = new Set(
    rooms.flatMap((room) => room.occupants.map((person) => person.userId)),
  );
  const unassignedTravelers = travelers.filter(
    (traveler) => !assignedUserIds.has(traveler.userId),
  );
  return (
    <>
      {!isStaff && ownRoom ? (
        <Card as="article" spacing="compact" arrangement="stack">
          <div className="grid gap-2">
            <span className="text-xs text-content-subtle">{t("yourRoom")}</span>
            <strong className="text-lg">{ownRoom.name}</strong>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-block rounded-full border border-border px-3 py-2 text-xs font-semibold text-content-muted">
              {t("occupiedCapacityBeds", {
                occupied: ownRoom.occupiedCount,
                capacity: ownRoom.capacity,
              })}
            </span>
            <Button
              appearance="quiet"
              size="sm"
              className="size-10 min-h-10 shrink-0 p-0"
              aria-label={t(ownRoom.isLocked ? "unlockRoom" : "lockRoom")}
              onPress={() => void toggleLock(ownRoom)}
              isDisabled={
                mutations.setRoomLock.isPending ||
                (!ownRoom.isLocked && ownRoom.occupiedCount < ownRoom.capacity)
              }
            >
              {ownRoom.isLocked ? (
                <Lock aria-hidden="true" size={18} />
              ) : (
                <LockOpen aria-hidden="true" size={18} />
              )}
            </Button>
          </div>
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
      ) : !isStaff ? (
        <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
          {t("youHaveNotBeenAssignedARoomYet")}
        </p>
      ) : null}
      {isStaff && (
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <Card
            spacing="compact"
            arrangement="stack"
            onDragOver={(event: DragEvent<HTMLElement>) => {
              if (isStaff && draggedOccupant?.roomId) {
                event.preventDefault();
                setDragOverTargetId(UNASSIGNED_DROP_TARGET_ID);
              }
            }}
            onDragLeave={(event: DragEvent<HTMLElement>) =>
              handleDragLeave(event, UNASSIGNED_DROP_TARGET_ID)
            }
            onDrop={(event: DragEvent<HTMLElement>) =>
              void handleDropOnUnassigned(event)
            }
            {...(dragOverTargetId === UNASSIGNED_DROP_TARGET_ID
              ? { className: "border-accent bg-surface-raised" }
              : {})}
          >
            <strong>{t("unassignedParticipants")}</strong>
            <p className="text-sm text-content-muted">
              {t("dropTravelerHereToUnassign")}
            </p>
            {unassignedTravelers.length > 0 ? (
              <ul className="max-h-72 list-inside list-disc space-y-1 overflow-y-auto overscroll-contain leading-relaxed text-content-muted">
                {unassignedTravelers.map((person) => (
                  <li
                    key={person.userId}
                    draggable
                    onDragStart={(event) =>
                      handleDragStart(event, person, null)
                    }
                    onDragEnd={clearDragState}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    {person.firstName} {person.lastName}
                    {person.userId === userId ? ` · ${t("you")}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-content-subtle">
                {t("noUnassignedParticipants")}
              </p>
            )}
          </Card>
          {rooms.map((room) => (
            <Card
              as="article"
              spacing="compact"
              arrangement="stack"
              key={room.id}
              onDragOver={(event: DragEvent<HTMLElement>) =>
                handleRoomDragOver(
                  event,
                  room.id,
                  room.capacity,
                  room.occupiedCount,
                )
              }
              onDragLeave={(event: DragEvent<HTMLElement>) =>
                handleDragLeave(event, room.id)
              }
              onDrop={(event: DragEvent<HTMLElement>) =>
                void handleDrop(event, room.id)
              }
              {...(dragOverTargetId === room.id
                ? { className: "border-accent bg-surface-raised" }
                : {})}
            >
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-lg">{room.name}</strong>
                  <div className="flex items-center gap-2">
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
                      className={
                        room.genderPolicy === "mixed"
                          ? "inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-warning bg-[color-mix(in_srgb,var(--theme-color-warning),transparent_82%)] px-3 text-sm font-extrabold text-warning shadow-sm ring-2 ring-[color-mix(in_srgb,var(--theme-color-warning),transparent_84%)]"
                          : "inline-flex size-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--theme-color-success),transparent_92%)] text-xs font-semibold text-content-subtle"
                      }
                    >
                      {room.genderPolicy === "mixed" ? (
                        <>
                          <span aria-hidden="true">M</span>
                          <span>{t("mixedRoom")}</span>
                        </>
                      ) : room.occupants[0]?.gender === "M" ? (
                        "H"
                      ) : room.occupants[0]?.gender === "F" ? (
                        "F"
                      ) : (
                        "—"
                      )}
                    </span>
                    <Button
                      appearance="quiet"
                      size="sm"
                      className="size-10 min-h-10 shrink-0 p-0"
                      aria-label={t(room.isLocked ? "unlockRoom" : "lockRoom")}
                      onPress={() => void toggleLock(room)}
                      isDisabled={
                        mutations.setRoomLock.isPending ||
                        (!room.isLocked && room.occupiedCount < room.capacity)
                      }
                    >
                      {room.isLocked ? (
                        <Lock aria-hidden="true" size={18} />
                      ) : (
                        <LockOpen aria-hidden="true" size={18} />
                      )}
                    </Button>
                  </div>
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
              {room.occupants.length ? (
                <ul className="list-inside list-disc space-y-1 leading-relaxed text-content-muted">
                  {room.occupants.map((person) => (
                    <li
                      key={person.userId}
                      draggable={isStaff || person.userId === userId}
                      onDragStart={(event) =>
                        handleDragStart(event, person, room.id)
                      }
                      onDragEnd={clearDragState}
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
                    handleRoomDragOver(
                      event,
                      room.id,
                      room.capacity,
                      room.occupiedCount,
                    )
                  }
                  onDragLeave={(event: DragEvent<HTMLElement>) =>
                    handleDragLeave(event, room.id)
                  }
                  onDrop={(event: DragEvent<HTMLElement>) =>
                    void handleDrop(event, room.id)
                  }
                  {...(dragOverTargetId === room.id
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
