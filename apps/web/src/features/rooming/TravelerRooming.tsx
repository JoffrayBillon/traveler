import { useRoomingMutations } from "@traveler/api/rooming/mutations";
import type { RoomSummary } from "@traveler/api/rooming/rooming.types";
import { Button, Card } from "@traveler/components/ui";
import { Lock, LockOpen } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { roomErrorLabel } from "./rooming-errors";
import { TravelerRoomPlanDialog } from "./TravelerRoomPlanDialog";

export function TravelerRooming({
  tripId,
  rooms,
  ownRoom,
  userId,
  onMessage,
}: {
  tripId: string;
  rooms: RoomSummary[];
  ownRoom: RoomSummary | undefined;
  userId: string;
  onMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const mutations = useRoomingMutations(tripId);
  const lockButton = useRef<HTMLButtonElement>(null);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const isLocked = ownRoom?.isLocked ?? false;
  useLayoutEffect(() => {
    if (!isLocked || !isPlanOpen) return;
    setIsPlanOpen(false);
    lockButton.current?.focus();
  }, [isLocked, isPlanOpen]);

  async function toggleLock() {
    if (!ownRoom) return;
    try {
      await mutations.setRoomLock.mutateAsync({
        roomId: ownRoom.id,
        locked: !ownRoom.isLocked,
      });
      onMessage(ownRoom.isLocked ? t("roomUnlocked") : t("roomLocked"));
    } catch (error) {
      const code = (error as { code?: string }).code;
      onMessage(t(roomErrorLabel[code ?? ""] ?? "roomLockCouldNotBeChanged"));
    }
  }

  return (
    <Card as="article" spacing="compact" arrangement="stack">
      {ownRoom ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-2">
              <span className="text-xs text-content-subtle">
                {t("yourRoom")}
              </span>
              <strong className="text-lg">{ownRoom.name}</strong>
              <span className="text-sm text-content-muted">
                {t("occupiedCapacityBeds", {
                  occupied: ownRoom.occupiedCount,
                  capacity: ownRoom.capacity,
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                ref={lockButton}
                appearance="quiet"
                size="sm"
                className="size-10 min-h-10 shrink-0 p-0"
                aria-label={t(ownRoom.isLocked ? "unlockRoom" : "lockRoom")}
                onPress={() => void toggleLock()}
                isDisabled={
                  mutations.setRoomLock.isPending ||
                  (!ownRoom.isLocked &&
                    ownRoom.occupiedCount < ownRoom.capacity)
                }
              >
                {ownRoom.isLocked ? (
                  <Lock aria-hidden="true" size={18} />
                ) : (
                  <LockOpen aria-hidden="true" size={18} />
                )}
              </Button>
            </div>
          </div>
          <ul className="list-inside list-disc space-y-1 leading-relaxed text-content-muted">
            {ownRoom.occupants.map((person) => (
              <li key={person.userId}>
                {person.firstName} {person.lastName}
                {person.userId === userId ? ` · ${t("you")}` : ""}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-content-muted">
          {t("youHaveNotBeenAssignedARoomYet")}
        </p>
      )}
      {isLocked ? (
        <p className="text-sm text-content-muted">
          {t("yourRoomIsLockedNoExchangeRequests")}
        </p>
      ) : rooms.some((room) => !room.isLocked) ? (
        <div>
          <TravelerRoomPlanDialog
            tripId={tripId}
            isOpen={isPlanOpen}
            onOpenChange={setIsPlanOpen}
            rooms={rooms}
            ownRoom={ownRoom}
            userId={userId}
            onMessage={onMessage}
          />
        </div>
      ) : null}
    </Card>
  );
}
