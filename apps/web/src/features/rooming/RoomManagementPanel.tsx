import type { StaffTraveler } from "@traveler/api/participants/participant.types";
import { useRoomingMutations } from "@traveler/api/rooming/mutations";
import type {
  RoomAssignmentPlan,
  RoomSummary,
} from "@traveler/api/rooming/rooming.types";
import {
  Button,
  listBoxStyles,
  messageStyles,
  SelectTrigger,
  textFieldStyles,
} from "@traveler/components/ui";
import { ChevronDown } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  ComboBox,
  Dialog,
  Form,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { RoomHistoryButton } from "./RoomHistoryButton";
import { RoomPlanPreview } from "./RoomPlanPreview";
import { roomErrorLabel } from "./rooming-errors";

const UNASSIGNED_ROOM_ID = "__unassigned__";

export function RoomManagementPanel({
  tripId,
  rooms,
  travelers,
  travelerId,
  onTravelerChange,
  onMessage,
}: {
  tripId: string;
  rooms: RoomSummary[];
  travelers: StaffTraveler[];
  travelerId: string | null | undefined;
  onTravelerChange: (id: string | null | undefined) => void;
  onMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const mutations = useRoomingMutations(tripId);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState("");
  const [exchangeWithUserId, setExchangeWithUserId] = useState<string | null>(
    null,
  );
  const [roomPlan, setRoomPlan] = useState<RoomAssignmentPlan | null>(null);
  const roomByTravelerId = new Map(
    rooms.flatMap((room) =>
      room.occupants.map((occupant) => [occupant.userId, room.id] as const),
    ),
  );
  const currentRoomId = travelerId
    ? (roomByTravelerId.get(travelerId) ?? null)
    : null;
  const availableRooms = rooms.filter(
    (room) =>
      room.id !== currentRoomId &&
      (room.occupiedCount < room.capacity || currentRoomId !== null),
  );
  const destinationRoom = availableRooms.find((room) => room.id === roomId);
  const exchangeRequired =
    destinationRoom !== undefined &&
    destinationRoom.occupiedCount >= destinationRoom.capacity;
  const isExchange = exchangeRequired || exchangeWithUserId !== null;
  const assignmentReady = Boolean(
    roomId &&
      (roomId === UNASSIGNED_ROOM_ID
        ? currentRoomId
        : destinationRoom &&
          (!isExchange ||
            destinationRoom.occupants.some(
              (person) => person.userId === exchangeWithUserId,
            ))),
  );
  const destinations = availableRooms.map((room) => ({
    id: room.id,
    name: room.name,
    label:
      room.occupiedCount >= room.capacity
        ? t("fullRoomExchangeOption", {
            room: room.name,
            capacity: room.capacity,
          })
        : `${room.name} · ${room.occupiedCount}/${room.capacity}`,
  }));
  if (currentRoomId) {
    const name = t("unassignedParticipants");
    destinations.unshift({ id: UNASSIGNED_ROOM_ID, name, label: name });
  }

  function closeAssignment() {
    setAssignmentError("");
    setRoomId(null);
    setExchangeWithUserId(null);
    onTravelerChange(undefined);
  }

  async function generateAssignments() {
    try {
      const plan = await mutations.previewRoomAssignments.mutateAsync();
      setRoomPlan(plan);
    } catch {
      onMessage(t("roomPlanCouldNotBeGenerated"));
    }
  }

  async function applyRoomPlan(snapshot: string) {
    try {
      const result =
        await mutations.generateRoomAssignments.mutateAsync(snapshot);
      setRoomPlan(null);
      onMessage(
        result.missingGender > 0
          ? t("roomAssignmentsGeneratedWithMissingGender", {
              assigned: result.assigned,
              missingGender: result.missingGender,
            })
          : t("roomAssignmentsGenerated", { assigned: result.assigned }),
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "room_plan_changed") {
        setRoomPlan(null);
        onMessage(t("roomPlanChangedRefreshPreview"));
        return;
      }
      onMessage(t("roomPlanCouldNotBeGenerated"));
    }
  }

  async function moveTraveler(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId || !travelerId || !assignmentReady) return;
    setAssignmentError("");
    try {
      if (roomId === UNASSIGNED_ROOM_ID) {
        if (!currentRoomId) return;
        await mutations.unassignTraveler.mutateAsync({
          roomId: currentRoomId,
          userId: travelerId,
        });
        onMessage(t("travelerRemovedFromRoom"));
      } else {
        await mutations.moveTraveler.mutateAsync({
          roomId,
          userId: travelerId,
          expectedRoomId: currentRoomId,
          ...(exchangeWithUserId ? { exchangeWithUserId } : {}),
        });
        onMessage(t("roomAssignmentsHaveBeenUpdated"));
      }
      closeAssignment();
    } catch (error) {
      const code = (error as { code?: string }).code;
      setAssignmentError(t(roomErrorLabel[code ?? ""] ?? "operationFailed"));
    }
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid gap-1">
          <h4 className="text-base font-bold">{t("currentRoomAssignments")}</h4>
          <p className="text-sm text-content-muted">
            {t("roomPlanGenerationDescription")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {travelers.length > 0 && rooms.length > 0 && (
            <Button
              appearance="secondary"
              onPress={() => onTravelerChange(null)}
            >
              {t("manualRoomAssignmentAction")}
            </Button>
          )}
          <Button
            appearance="secondary"
            onPress={() => void generateAssignments()}
            isDisabled={mutations.previewRoomAssignments.isPending}
          >
            {mutations.previewRoomAssignments.isPending
              ? t("generatingRoomPlan")
              : t("generateRoomPlan")}
          </Button>
          <RoomHistoryButton tripId={tripId} />
        </div>
      </div>
      <ModalOverlay
        isOpen={travelerId !== undefined}
        onOpenChange={(open) => {
          if (!open) closeAssignment();
        }}
        isDismissable={
          !mutations.moveTraveler.isPending &&
          !mutations.unassignTraveler.isPending
        }
        className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm data-[entering]:animate-[fade-in_140ms_ease-out] data-[exiting]:animate-[fade-out_120ms_ease-in]"
      >
        <Modal className="w-full max-w-2xl outline-none data-[entering]:animate-[modal-enter_220ms_ease-out] data-[exiting]:animate-[modal-exit_150ms_ease-in]">
          <Dialog
            aria-labelledby="manual-room-assignment-title"
            aria-describedby="manual-room-assignment-description"
            className="grid gap-5 rounded-feature border border-border bg-surface p-5 text-content shadow-panel outline-none sm:p-6"
          >
            <div className="grid gap-2">
              <Heading
                slot="title"
                id="manual-room-assignment-title"
                className="text-lg font-bold"
              >
                {t("manualRoomAssignmentTitle")}
              </Heading>
              <p
                id="manual-room-assignment-description"
                className="text-sm leading-relaxed text-content-muted"
              >
                {t("manualRoomAssignmentDescription")}
              </p>
            </div>
            <Form
              className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              onSubmit={moveTraveler}
            >
              <Select
                className="grid min-w-0 gap-2"
                selectedKey={travelerId ?? null}
                onSelectionChange={(key) => {
                  onTravelerChange(key ? String(key) : null);
                  setRoomId(null);
                  setExchangeWithUserId(null);
                }}
                isRequired
              >
                <Label className={textFieldStyles().label()}>
                  {t("travelerToMove")}
                </Label>
                <SelectTrigger className="min-w-0">
                  <SelectValue className="block truncate" />
                </SelectTrigger>
                <Popover>
                  <ListBox className={listBoxStyles().list()}>
                    {travelers.map((person) => (
                      <ListBoxItem
                        className={listBoxStyles().item()}
                        key={person.userId}
                        id={person.userId}
                        textValue={`${person.firstName} ${person.lastName}`}
                      >
                        {person.firstName} {person.lastName}
                        {roomByTravelerId.has(person.userId)
                          ? ` · ${t("alreadyAssigned")}`
                          : ` · ${t("unassigned")}`}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </Popover>
              </Select>
              <ComboBox
                className="grid min-w-0 gap-2"
                key={travelerId ?? ""}
                defaultItems={destinations}
                selectedKey={roomId}
                onSelectionChange={(key) => {
                  setRoomId(key ? String(key) : null);
                  setExchangeWithUserId(null);
                }}
                isDisabled={!travelerId}
                menuTrigger="focus"
                allowsEmptyCollection
                isRequired
              >
                <Label className={textFieldStyles().label()}>
                  {t("destinationRoom")}
                </Label>
                <div className="relative">
                  <Input
                    className={textFieldStyles().input({ class: "pr-12" })}
                    placeholder={t("searchRoomByNumber")}
                  />
                  <Button
                    appearance="quiet"
                    className="absolute inset-y-0 right-0 h-full px-3"
                    aria-label={t("destinationRoom")}
                  >
                    <ChevronDown aria-hidden="true" size={16} />
                  </Button>
                </div>
                <Popover className="w-(--trigger-width)">
                  <ListBox<(typeof destinations)[number]>
                    className={listBoxStyles().list()}
                    renderEmptyState={() => (
                      <span className="block p-3 text-sm text-content-muted">
                        {t("noMatchingAvailableRooms")}
                      </span>
                    )}
                  >
                    {(room) => (
                      <ListBoxItem
                        className={listBoxStyles().item()}
                        id={room.id}
                        textValue={room.name}
                      >
                        {room.label}
                      </ListBoxItem>
                    )}
                  </ListBox>
                </Popover>
              </ComboBox>
              {isExchange && destinationRoom && (
                <Select
                  className="grid min-w-0 gap-2 sm:col-span-2"
                  selectedKey={exchangeWithUserId}
                  onSelectionChange={(key) =>
                    setExchangeWithUserId(key ? String(key) : null)
                  }
                  isRequired
                >
                  <Label className={textFieldStyles().label()}>
                    {t("roomExchangePartner")}
                  </Label>
                  <SelectTrigger className="min-w-0">
                    <SelectValue className="block truncate" />
                  </SelectTrigger>
                  <Popover>
                    <ListBox className={listBoxStyles().list()}>
                      {destinationRoom.occupants.map((person) => (
                        <ListBoxItem
                          className={listBoxStyles().item()}
                          key={person.userId}
                          id={person.userId}
                          textValue={`${person.firstName} ${person.lastName}`}
                        >
                          {person.firstName} {person.lastName}
                        </ListBoxItem>
                      ))}
                    </ListBox>
                  </Popover>
                </Select>
              )}
              {assignmentError && (
                <p
                  role="alert"
                  className={messageStyles({
                    tone: "danger",
                    className: "sm:col-span-2",
                  })}
                >
                  {assignmentError}
                </p>
              )}
              <footer className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                <Button
                  appearance="quiet"
                  type="button"
                  onPress={closeAssignment}
                  isDisabled={
                    mutations.moveTraveler.isPending ||
                    mutations.unassignTraveler.isPending
                  }
                >
                  {t("cancel")}
                </Button>
                <Button
                  appearance="secondary"
                  type="submit"
                  isDisabled={
                    !assignmentReady ||
                    mutations.moveTraveler.isPending ||
                    mutations.unassignTraveler.isPending
                  }
                >
                  {mutations.moveTraveler.isPending ||
                  mutations.unassignTraveler.isPending
                    ? t("saving")
                    : roomId === UNASSIGNED_ROOM_ID
                      ? t("removeRoomAssignment")
                      : isExchange
                        ? t("swapRoomPlaces")
                        : t("assign2")}
                </Button>
              </footer>
            </Form>
          </Dialog>
        </Modal>
      </ModalOverlay>
      {roomPlan && (
        <RoomPlanPreview
          plan={roomPlan}
          isApplying={mutations.generateRoomAssignments.isPending}
          onApply={(snapshot) => void applyRoomPlan(snapshot)}
          onCancel={() => setRoomPlan(null)}
        />
      )}
    </section>
  );
}
