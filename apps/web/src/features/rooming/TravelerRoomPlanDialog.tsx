import { useRoomingMutations } from "@traveler/api/rooming/mutations";
import type { RoomSummary } from "@traveler/api/rooming/rooming.types";
import { Button, Card } from "@traveler/components/ui";
import { ArrowLeftRight, X } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { roomErrorLabel } from "./rooming-errors";

export function TravelerRoomPlanDialog({
  tripId,
  isOpen,
  onOpenChange,
  rooms,
  ownRoom,
  userId,
  onMessage,
}: {
  tripId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: RoomSummary[];
  ownRoom: RoomSummary;
  userId: string;
  onMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const mutations = useRoomingMutations(tripId);

  async function requestExchange(
    person: RoomSummary["occupants"][number],
    room: RoomSummary,
  ) {
    try {
      await mutations.createRequest.mutateAsync({
        moves: [
          {
            userId,
            expectedRoomId: ownRoom.id,
            targetRoomId: room.id,
          },
          {
            userId: person.userId,
            expectedRoomId: room.id,
            targetRoomId: ownRoom.id,
          },
        ],
      });
      onOpenChange(false);
      onMessage(t("yourSwapProposalHasBeenSentToThePeopleInvolved"));
    } catch (error) {
      const code = (error as { code?: string }).code;
      onMessage(
        t(roomErrorLabel[code ?? ""] ?? "roomAssignmentsCouldNotBeUpdated"),
      );
    }
  }

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button appearance="secondary">{t("viewRoomPlan")}</Button>
      <ModalOverlay
        isDismissable={!mutations.createRequest.isPending}
        className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm data-[entering]:animate-[fade-in_140ms_ease-out] data-[exiting]:animate-[fade-out_120ms_ease-in] max-sm:items-end max-sm:p-0"
      >
        <Modal className="w-full max-w-5xl outline-none data-[entering]:animate-[modal-enter_220ms_ease-out] data-[exiting]:animate-[modal-exit_150ms_ease-in]">
          <Dialog className="mx-auto flex max-h-[min(88dvh,64rem)] flex-col overflow-hidden rounded-feature border border-border bg-surface text-content shadow-panel outline-none max-sm:max-h-[92dvh] max-sm:rounded-b-none max-sm:rounded-t-feature">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
              <div className="grid gap-1">
                <Heading slot="title" className="text-lg font-bold">
                  {t("roomPlan")}
                </Heading>
                <p className="text-sm text-content-muted">
                  {t("selectRoommateToRequestExchange")}
                </p>
              </div>
              <Button appearance="quiet" slot="close" aria-label={t("close")}>
                <X aria-hidden="true" size={18} />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rooms
                  .filter((room) => !room.isLocked)
                  .map((room) => {
                    const isOwnRoom = room.id === ownRoom.id;
                    return (
                      <Card
                        key={room.id}
                        as="article"
                        spacing="compact"
                        arrangement="stack"
                        {...(isOwnRoom ? { className: "border-accent" } : {})}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="grid gap-1">
                            <strong>{room.name}</strong>
                            <span className="text-sm text-content-muted">
                              {t("occupiedCapacityBeds", {
                                occupied: room.occupiedCount,
                                capacity: room.capacity,
                              })}
                            </span>
                          </div>
                          {isOwnRoom && (
                            <span className="text-xs font-semibold text-accent">
                              {t("yourRoom")}
                            </span>
                          )}
                        </div>
                        {room.occupants.length ? (
                          <ul className="grid gap-1">
                            {room.occupants.map((person) => {
                              const isSelf = person.userId === userId;
                              return (
                                <li key={person.userId}>
                                  {isOwnRoom || isSelf ? (
                                    <span className="block min-h-10 wrap-anywhere px-2 py-2 text-sm text-content-muted">
                                      {person.firstName} {person.lastName}
                                      {isSelf ? ` · ${t("you")}` : ""}
                                    </span>
                                  ) : (
                                    <Button
                                      appearance="quiet"
                                      className="h-auto min-h-10 w-full justify-start px-2 py-1 text-left"
                                      onPress={() =>
                                        void requestExchange(person, room)
                                      }
                                      isDisabled={
                                        mutations.createRequest.isPending
                                      }
                                      aria-label={t("requestRoomExchangeWith", {
                                        name: `${person.firstName} ${person.lastName}`,
                                      })}
                                    >
                                      <ArrowLeftRight
                                        aria-hidden="true"
                                        className="shrink-0"
                                        size={16}
                                      />
                                      <span className="min-w-0 wrap-anywhere">
                                        {person.firstName} {person.lastName}
                                      </span>
                                    </Button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-sm text-content-subtle">
                            {t("emptyRoom")}
                          </p>
                        )}
                      </Card>
                    );
                  })}
              </div>
            </div>
            <footer className="flex shrink-0 justify-end border-t border-border px-5 py-4 sm:px-7">
              <Button appearance="secondary" slot="close">
                {t("close")}
              </Button>
            </footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
