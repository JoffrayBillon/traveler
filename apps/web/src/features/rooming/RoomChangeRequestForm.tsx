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
import type { RoomSummary } from "./rooming.types";
import { roomErrorLabel } from "./rooming-errors";
import { useRoomingMutations } from "./rooming-mutations";

export function RoomChangeRequestForm({
  tripId,
  userId,
  rooms,
  ownRoom,
  onMessage,
}: {
  tripId: string;
  userId: string;
  rooms: RoomSummary[];
  ownRoom: RoomSummary | undefined;
  onMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const mutations = useRoomingMutations(tripId);
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null);
  const [exchangeEmail, setExchangeEmail] = useState("");
  const targetRooms = rooms.filter(
    (room) =>
      room.id !== ownRoom?.id &&
      (room.occupiedCount < room.capacity || Boolean(ownRoom)),
  );
  const selectedTargetRoom = rooms.find((room) => room.id === targetRoomId);
  const exchangeRequired = Boolean(
    ownRoom &&
      selectedTargetRoom &&
      selectedTargetRoom.occupiedCount >= selectedTargetRoom.capacity,
  );

  async function requestChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetRoomId) return;
    if (exchangeRequired && !exchangeEmail.trim()) {
      onMessage(t("enterTheEmailAddressOfThePersonYouWantToSwapWith"));
      return;
    }
    const payload = exchangeEmail.trim()
      ? {
          targetRoomId,
          exchangeWithEmail: exchangeEmail.trim().toLowerCase(),
        }
      : {
          moves: [
            { userId, expectedRoomId: ownRoom?.id ?? null, targetRoomId },
          ],
        };
    try {
      await mutations.createRequest.mutateAsync(payload);
      onMessage(
        exchangeEmail.trim()
          ? t("yourSwapProposalHasBeenSentToThePeopleInvolved")
          : t("yourRoomRequestHasBeenRecorded"),
      );
      setTargetRoomId(null);
      setExchangeEmail("");
    } catch (error) {
      const code = (error as { code?: string }).code;
      onMessage(t(roomErrorLabel[code ?? ""] ?? "L’opération a échoué."));
    }
  }

  if (targetRooms.length === 0) return null;
  return (
    <Form
      className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 max-[420px]:grid-cols-1"
      onSubmit={requestChange}
    >
      <Select
        className="grid min-w-0 gap-2"
        selectedKey={targetRoomId}
        onSelectionChange={(key) => setTargetRoomId(key ? String(key) : null)}
        isRequired
      >
        <Label className={textFieldStyles().label()}>
          {t("requestABedInAnotherRoom")}
        </Label>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <Popover>
          <ListBox className={listBoxStyles().list()}>
            {targetRooms.map((room) => (
              <ListBoxItem
                className={listBoxStyles().item()}
                key={room.id}
                id={room.id}
                textValue={room.name}
              >
                {t("roomCountBedSAvailable", {
                  room: room.name,
                  count: room.capacity - room.occupiedCount,
                })}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
      {ownRoom && (
        <TextField
          className="grid min-w-0 gap-2"
          type="email"
          value={exchangeEmail}
          onChange={setExchangeEmail}
          isRequired={exchangeRequired}
        >
          <Label className={textFieldStyles().label()}>
            {t("emailOfThePersonToExchangeWith")}
            {exchangeRequired ? t("required") : t("optional")}
          </Label>
          <Input className={textFieldStyles().input()} autoComplete="email" />
        </TextField>
      )}
      <Button
        type="submit"
        appearance="secondary"
        isDisabled={mutations.createRequest.isPending}
      >
        {exchangeEmail.trim() ? t("proposeAnExchange") : t("sendMyRequest")}
      </Button>
    </Form>
  );
}
