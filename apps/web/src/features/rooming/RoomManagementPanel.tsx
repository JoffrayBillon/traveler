import type { StaffTraveler } from "@traveler/api/participants/participant.types";
import { useRoomingMutations } from "@traveler/api/rooming/mutations";
import { useRoomInventoryQuery } from "@traveler/api/rooming/queries";
import type {
  RoomAssignmentPlan,
  RoomSummary,
} from "@traveler/api/rooming/rooming.types";
import {
  Button,
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "@traveler/components/ui";
import { type FormEvent, useState } from "react";
import {
  Form,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { RoomInventoryEditor } from "./RoomInventoryEditor";
import { RoomPlanPreview } from "./RoomPlanPreview";
import { roomErrorLabel } from "./rooming-errors";

export function RoomManagementPanel({
  tripId,
  rooms,
  travelers,
  onMessage,
}: {
  tripId: string;
  rooms: RoomSummary[];
  travelers: StaffTraveler[];
  onMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const mutations = useRoomingMutations(tripId);
  const inventoryQuery = useRoomInventoryQuery(tripId, true);
  const [roomName, setRoomName] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("4");
  const [travelerId, setTravelerId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomPlan, setRoomPlan] = useState<RoomAssignmentPlan | null>(null);
  const roomByTravelerId = new Map(
    rooms.flatMap((room) =>
      room.occupants.map((occupant) => [occupant.userId, room.id] as const),
    ),
  );
  const availableRooms = rooms.filter((room) => {
    const isCurrentRoom = room.occupants.some(
      (occupant) => occupant.userId === travelerId,
    );
    return room.occupiedCount < room.capacity || isCurrentRoom;
  });

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await mutations.createRoom.mutateAsync({
        name: roomName,
        capacity: Number(roomCapacity),
      });
    } catch {
      onMessage(t("thisRoomCouldNotBeCreatedCheckItsNameAndCapacity"));
      return;
    }
    setRoomName("");
    setRoomCapacity("4");
    onMessage(t("theRoomWasCreated"));
  }

  async function generateAssignments() {
    try {
      const plan = await mutations.previewRoomAssignments.mutateAsync();
      setRoomPlan(plan);
    } catch {
      onMessage(t("roomPlanCouldNotBeGenerated"));
    }
  }

  async function saveInventory(
    inventory: { capacity: number; quantity: number }[],
  ) {
    try {
      await mutations.saveRoomInventory.mutateAsync(inventory);
      onMessage(t("roomInventorySaved"));
    } catch (error) {
      const code = (error as { code?: string }).code;
      onMessage(
        code === "room_inventory_locked"
          ? t("roomInventoryLocked")
          : t("roomInventoryCouldNotBeSaved"),
      );
    }
  }

  async function applyRoomPlan(snapshot: string) {
    try {
      const result =
        await mutations.generateRoomAssignments.mutateAsync(snapshot);
      setRoomPlan(null);
      onMessage(
        result.unconfirmed > 0
          ? t("roomAssignmentsGeneratedWithUnconfirmed", {
              assigned: result.assigned,
              unconfirmed: result.unconfirmed,
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
    if (!roomId || !travelerId) return;
    try {
      await mutations.moveTraveler.mutateAsync({
        roomId,
        userId: travelerId,
        expectedRoomId: roomByTravelerId.get(travelerId) ?? null,
      });
      onMessage(t("roomAssignmentsHaveBeenUpdated"));
      setRoomId(null);
      setTravelerId(null);
    } catch (error) {
      const code = (error as { code?: string }).code;
      onMessage(t(roomErrorLabel[code ?? ""] ?? "L’opération a échoué."));
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h4 className="text-base font-bold">{t("roomPlan")}</h4>
          <p className="text-sm text-content-muted">
            {t("roomPlanInventoryDescription")}
          </p>
        </div>
        <Button
          appearance="secondary"
          onPress={() => void generateAssignments()}
          isDisabled={mutations.previewRoomAssignments.isPending}
        >
          {mutations.previewRoomAssignments.isPending
            ? t("generatingRoomPlan")
            : t("generateRoomPlan")}
        </Button>
      </div>
      {roomPlan && (
        <RoomPlanPreview
          plan={roomPlan}
          isApplying={mutations.generateRoomAssignments.isPending}
          onApply={(snapshot) => void applyRoomPlan(snapshot)}
          onCancel={() => setRoomPlan(null)}
        />
      )}
      <RoomInventoryEditor
        inventory={inventoryQuery.data?.inventory}
        isLocked={rooms.length > 0}
        isSaving={mutations.saveRoomInventory.isPending}
        onSave={(inventory) => void saveInventory(inventory)}
      />
      <h4 className="text-base font-bold">{t("createARoom")}</h4>
      <Form
        className="grid grid-cols-[repeat(2,minmax(0,1fr))_auto] items-end gap-3 max-[420px]:grid-cols-1"
        onSubmit={createRoom}
      >
        <TextField
          className="grid min-w-0 gap-2"
          value={roomName}
          onChange={setRoomName}
          isRequired
        >
          <Label className={textFieldStyles().label()}>{t("roomName")}</Label>
          <Input
            className={textFieldStyles().input()}
            placeholder={t("eG101")}
            maxLength={80}
          />
        </TextField>
        <TextField
          className="grid min-w-0 gap-2"
          value={roomCapacity}
          onChange={setRoomCapacity}
          isRequired
        >
          <Label className={textFieldStyles().label()}>{t("capacity")}</Label>
          <Input
            className={textFieldStyles().input()}
            type="number"
            min="1"
            max="12"
          />
        </TextField>
        <Button
          appearance="secondary"
          type="submit"
          isDisabled={mutations.createRoom.isPending}
        >
          {t("create")}
        </Button>
      </Form>
      {travelers.length > 0 && availableRooms.length > 0 && (
        <Form
          className="grid grid-cols-[repeat(2,minmax(0,1fr))_auto] items-end gap-3 max-[420px]:grid-cols-1"
          onSubmit={moveTraveler}
        >
          <Select
            className="grid min-w-0 gap-2"
            selectedKey={travelerId}
            onSelectionChange={(key) => setTravelerId(key ? String(key) : null)}
            isRequired
          >
            <Label className={textFieldStyles().label()}>
              {t("travelerToMove")}
            </Label>
            <SelectTrigger>
              <SelectValue />
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
          <Select
            className="grid min-w-0 gap-2"
            selectedKey={roomId}
            onSelectionChange={(key) => setRoomId(key ? String(key) : null)}
            isRequired
          >
            <Label className={textFieldStyles().label()}>
              {t("destinationRoom")}
            </Label>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <Popover>
              <ListBox className={listBoxStyles().list()}>
                {availableRooms.map((room) => (
                  <ListBoxItem
                    className={listBoxStyles().item()}
                    key={room.id}
                    id={room.id}
                    textValue={room.name}
                  >
                    {room.name} · {room.occupiedCount}/{room.capacity}
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
          <Button
            appearance="secondary"
            type="submit"
            isDisabled={mutations.moveTraveler.isPending}
          >
            {t("assign2")}
          </Button>
        </Form>
      )}
    </section>
  );
}
