import type { StaffTraveler } from "@traveler/api/participants/participant.types";
import { useRoomingMutations } from "@traveler/api/rooming/mutations";
import type { RoomSummary } from "@traveler/api/rooming/rooming.types";
import { ParticipantSearchField } from "@traveler/components/ParticipantSearchField";
import { Button, Card } from "@traveler/components/ui";
import { normalizeSearchText } from "@traveler/lib/normalize-search-text";
import { ArrowLeftRight, GripVertical, Lock, LockOpen } from "lucide-react";
import { type DragEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { RoomCompositionBadge } from "./RoomCompositionBadge";
import { roomErrorLabel } from "./rooming-errors";

const UNASSIGNED_DROP_TARGET_ID = "__unassigned_drop_target__";

export function RoomOverview({
  tripId,
  rooms,
  travelers,
  ownRoom,
  userId,
  isStaff,
  onSelectTraveler,
  onMessage,
}: {
  tripId: string;
  rooms: RoomSummary[];
  travelers: StaffTraveler[];
  ownRoom: RoomSummary | undefined;
  userId: string;
  isStaff: boolean;
  onSelectTraveler: (userId: string) => void;
  onMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const mutations = useRoomingMutations(tripId);
  const [draggedOccupant, setDraggedOccupant] = useState<{
    userId: string;
    roomId: string | null;
  } | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [unassignedSearch, setUnassignedSearch] = useState("");

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

  async function handleDrop(
    event: DragEvent<HTMLElement>,
    roomId: string,
    exchangeWithUserId?: string,
  ) {
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
        ...(exchangeWithUserId ? { exchangeWithUserId } : {}),
      });
      onMessage(t("roomAssignmentsHaveBeenUpdated"));
    } catch (error) {
      const code = (error as { code?: string }).code;
      onMessage(
        t(roomErrorLabel[code ?? ""] ?? "roomAssignmentsCouldNotBeUpdated"),
      );
    }
  }

  function canExchangeWith(room: RoomSummary) {
    return Boolean(
      draggedOccupant?.roomId &&
        draggedOccupant.roomId !== room.id &&
        room.occupiedCount >= room.capacity,
    );
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
  const search = normalizeSearchText(unassignedSearch);
  const visibleUnassignedTravelers = unassignedTravelers.filter((person) =>
    normalizeSearchText(
      `${person.firstName} ${person.lastName} ${person.email ?? ""}`,
    ).includes(search),
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
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(13rem,17rem)_minmax(0,1fr)]">
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
            className={`lg:sticky lg:top-6 ${dragOverTargetId === UNASSIGNED_DROP_TARGET_ID ? "border-accent bg-surface-raised" : ""}`}
          >
            <strong>{t("unassignedParticipants")}</strong>
            <p className="hidden text-sm text-content-muted lg:block">
              {t("dropTravelerHereToUnassign")}
            </p>
            <ParticipantSearchField
              value={unassignedSearch}
              onChange={setUnassignedSearch}
            />
            {visibleUnassignedTravelers.length > 0 ? (
              <ul className="grid max-h-56 gap-1 overflow-y-auto overscroll-contain p-1 lg:max-h-[min(60dvh,36rem)]">
                {visibleUnassignedTravelers.map((person) => (
                  <li
                    key={person.userId}
                    draggable
                    onDragStart={(event) =>
                      handleDragStart(event, person, null)
                    }
                    onDragEnd={clearDragState}
                  >
                    <Button
                      appearance="quiet"
                      size="sm"
                      className="h-auto min-h-10 w-full justify-start px-2 text-left"
                      onPress={() => onSelectTraveler(person.userId)}
                      aria-haspopup="dialog"
                    >
                      <GripVertical
                        aria-hidden="true"
                        size={15}
                        className="hidden shrink-0 cursor-grab text-content-subtle lg:block"
                      />
                      <span className="min-w-0 flex-1 wrap-anywhere">
                        {person.firstName} {person.lastName}
                        {person.userId === userId ? ` · ${t("you")}` : ""}
                      </span>
                      <ArrowLeftRight
                        aria-hidden="true"
                        size={14}
                        className="shrink-0"
                      />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-content-subtle">
                {t(
                  unassignedTravelers.length
                    ? "noSearchResults"
                    : "noUnassignedParticipants",
                )}
              </p>
            )}
          </Card>
          <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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
                onDrop={(event: DragEvent<HTMLElement>) => {
                  if (room.occupiedCount < room.capacity)
                    void handleDrop(event, room.id);
                }}
                {...(dragOverTargetId === room.id
                  ? { className: "border-accent bg-surface-raised" }
                  : {})}
              >
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-lg">{room.name}</strong>
                    <div className="flex items-center gap-2">
                      <RoomCompositionBadge room={room} />
                      <Button
                        appearance="quiet"
                        size="sm"
                        className="size-10 min-h-10 shrink-0 p-0"
                        aria-label={t(
                          room.isLocked ? "unlockRoom" : "lockRoom",
                        )}
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
                  </span>
                </div>
                {room.occupants.length ? (
                  <ul className="grid gap-1">
                    {room.occupants.map((person) => (
                      <li
                        key={person.userId}
                        draggable={isStaff || person.userId === userId}
                        onDragStart={(event) =>
                          handleDragStart(event, person, room.id)
                        }
                        onDragEnd={clearDragState}
                        onDragOver={(event) => {
                          if (!canExchangeWith(room)) return;
                          event.preventDefault();
                          event.stopPropagation();
                          event.dataTransfer.dropEffect = "move";
                          setDragOverTargetId(`exchange:${person.userId}`);
                        }}
                        onDragLeave={(event) =>
                          handleDragLeave(event, `exchange:${person.userId}`)
                        }
                        onDrop={(event) => {
                          if (!canExchangeWith(room)) return;
                          event.stopPropagation();
                          void handleDrop(event, room.id, person.userId);
                        }}
                      >
                        <Button
                          appearance="quiet"
                          size="sm"
                          className={`h-auto min-h-10 w-full justify-start px-2 text-left ${dragOverTargetId === `exchange:${person.userId}` ? "bg-accent/15 text-accent ring-2 ring-inset ring-accent" : ""}`}
                          data-exchange-target={
                            dragOverTargetId === `exchange:${person.userId}` ||
                            undefined
                          }
                          onPress={() => onSelectTraveler(person.userId)}
                          aria-haspopup="dialog"
                        >
                          <GripVertical
                            aria-hidden="true"
                            size={15}
                            className="hidden shrink-0 cursor-grab text-content-subtle lg:block"
                          />
                          <span className="min-w-0 flex-1 wrap-anywhere">
                            {person.firstName} {person.lastName}
                          </span>
                          <ArrowLeftRight
                            aria-hidden="true"
                            size={14}
                            className="shrink-0"
                          />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-content-subtle">
                    {t("emptyRoom")}
                  </p>
                )}
              </Card>
            ))}
          </div>
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
