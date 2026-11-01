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
import {
  Button,
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "../../components/ui";
import type { StaffTraveler } from "../organizer/types";
import type { RoomSummary } from "./rooming.types";
import { roomErrorLabel } from "./rooming-errors";
import { useRoomingMutations } from "./rooming-mutations";

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
  const [roomName, setRoomName] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("4");
  const [travelerId, setTravelerId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const assignedTravelerIds = new Set(
    rooms.flatMap((room) => room.occupants.map((occupant) => occupant.userId)),
  );
  const unassignedTravelers = travelers.filter(
    (person) => !assignedTravelerIds.has(person.userId),
  );
  const availableRooms = rooms.filter(
    (room) => room.occupiedCount < room.capacity,
  );

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

  async function assignInitialRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId || !travelerId) return;
    try {
      await mutations.assignInitialRoom.mutateAsync({
        roomId,
        userId: travelerId,
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
      {unassignedTravelers.length > 0 && availableRooms.length > 0 && (
        <Form
          className="grid grid-cols-[repeat(2,minmax(0,1fr))_auto] items-end gap-3 max-[420px]:grid-cols-1"
          onSubmit={assignInitialRoom}
        >
          <Select
            className="grid min-w-0 gap-2"
            selectedKey={travelerId}
            onSelectionChange={(key) => setTravelerId(key ? String(key) : null)}
            isRequired
          >
            <Label className={textFieldStyles().label()}>
              {t("travelerToAssign")}
            </Label>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <Popover>
              <ListBox className={listBoxStyles().list()}>
                {unassignedTravelers.map((person) => (
                  <ListBoxItem
                    className={listBoxStyles().item()}
                    key={person.userId}
                    id={person.userId}
                    textValue={`${person.firstName} ${person.lastName}`}
                  >
                    {person.firstName} {person.lastName} · {person.email}
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
              {t("roomWithAnAvailableBed")}
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
            isDisabled={mutations.assignInitialRoom.isPending}
          >
            {t("assign2")}
          </Button>
        </Form>
      )}
    </section>
  );
}
