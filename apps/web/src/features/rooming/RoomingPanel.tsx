import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  messageStyles,
  SelectTrigger,
  textFieldStyles,
} from "../../components/ui";
import type { StaffTraveler } from "../organizer/types";

type RoomSummary = {
  id: string;
  name: string;
  capacity: number;
  occupiedCount: number;
  genderPolicy: "single_gender" | "mixed" | "unset";
  occupants: {
    userId: string;
    firstName: string;
    lastName: string;
    gender: "M" | "F" | null;
  }[];
};

type RoomRequestSummary = {
  id: string;
  requester?: { firstName: string; lastName: string };
  requiredConsents: {
    userId: string;
    firstName?: string;
    lastName?: string;
    approved: boolean;
  }[];
  moves: {
    userId: string;
    person?: { firstName: string; lastName: string };
    currentRoom?: string | null;
    targetRoom?: string;
  }[];
};

export function RoomingPanel({
  tripId,
  userId,
  role,
}: {
  tripId: string;
  userId: string;
  role: "traveler" | "companion" | "manager";
}) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [requests, setRequests] = useState<RoomRequestSummary[]>([]);
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null);
  const [exchangeEmail, setExchangeEmail] = useState("");
  const [initialTravelerId, setInitialTravelerId] = useState<string | null>(
    null,
  );
  const [initialRoomId, setInitialRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("4");
  const [unassignedTravelers, setUnassignedTravelers] = useState<
    StaffTraveler[]
  >([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const latestRefreshId = useRef(0);
  const ownRoom = rooms.find((room) =>
    room.occupants.some((person) => person.userId === userId),
  );
  const availableRooms = rooms.filter(
    (room) => room.id !== ownRoom?.id && room.occupiedCount < room.capacity,
  );
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
  const isStaff = role !== "traveler";

  const refresh = useCallback(async () => {
    const refreshId = ++latestRefreshId.current;
    setStatus("loading");
    try {
      const [roomResponse, requestResponse, travelerResponse] =
        await Promise.all([
          fetch(`/api/trips/${encodeURIComponent(tripId)}/rooms`, {
            cache: "no-store",
          }),
          fetch(`/api/trips/${encodeURIComponent(tripId)}/room-requests`, {
            cache: "no-store",
          }),
          isStaff
            ? fetch(`/api/trips/${encodeURIComponent(tripId)}/travelers`, {
                cache: "no-store",
              })
            : Promise.resolve(null),
        ]);
      if (
        !roomResponse.ok ||
        !requestResponse.ok ||
        (travelerResponse && !travelerResponse.ok)
      )
        throw new Error();
      const roomData = (await roomResponse.json()) as { rooms: RoomSummary[] };
      const requestData = (await requestResponse.json()) as {
        requests: RoomRequestSummary[];
      };
      const travelerData = travelerResponse
        ? ((await travelerResponse.json()) as { travelers: StaffTraveler[] })
        : null;
      if (refreshId !== latestRefreshId.current) return;
      setRooms(roomData.rooms);
      setRequests(requestData.requests);
      if (travelerData) {
        const assigned = new Set(
          roomData.rooms.flatMap((room) =>
            room.occupants.map((occupant) => occupant.userId),
          ),
        );
        setUnassignedTravelers(
          travelerData.travelers.filter(
            (person) => !assigned.has(person.userId),
          ),
        );
      }
      setStatus("ready");
    } catch {
      if (refreshId === latestRefreshId.current) setStatus("error");
    }
  }, [tripId, isStaff]);

  useEffect(() => {
    void refresh();
    return () => {
      latestRefreshId.current += 1;
    };
  }, [refresh]);

  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setMessage(
        t(roomErrorLabel[result.error ?? ""] ?? "L’opération a échoué."),
      );
      return false;
    }
    return true;
  }

  async function requestChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetRoomId) return;
    if (exchangeRequired && !exchangeEmail.trim()) {
      setMessage(t("enterTheEmailAddressOfThePersonYouWantToSwapWith"));
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
    const ok = await post(
      `/api/trips/${encodeURIComponent(tripId)}/room-requests`,
      payload,
    );
    if (ok) {
      setMessage(
        exchangeEmail.trim()
          ? t("yourSwapProposalHasBeenSentToThePeopleInvolved")
          : t("yourRoomRequestHasBeenRecorded"),
      );
      setTargetRoomId(null);
      setExchangeEmail("");
      await refresh();
    }
  }

  async function respond(requestId: string, approve: boolean) {
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/room-requests/${encodeURIComponent(requestId)}/consent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approve }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
      };
      if (!response.ok) {
        setMessage(
          t(roomErrorLabel[result.error ?? ""] ?? "L’opération a échoué."),
        );
        return;
      }
      setMessage(
        result.status === "stale"
          ? t("theRoomCompositionChangedThisRequestWasNotApplied")
          : approve
            ? t("yourApprovalHasBeenRecorded")
            : t("theRequestWasDeclined"),
      );
      await refresh();
    } catch {
      setMessage(t("yourResponseCouldNotBeSentCheckYourConnectionAndTryAgain"));
    }
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/rooms`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          capacity: Number(roomCapacity),
        }),
      },
    );
    if (!response.ok) {
      setMessage(t("thisRoomCouldNotBeCreatedCheckItsNameAndCapacity"));
      return;
    }
    setRoomName("");
    setRoomCapacity("4");
    setMessage(t("theRoomWasCreated"));
    await refresh();
  }

  async function assignInitialRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!initialRoomId || !initialTravelerId) return;
    const ok = await post(
      `/api/trips/${encodeURIComponent(tripId)}/rooms/${encodeURIComponent(initialRoomId)}/initial-assignment`,
      { userId: initialTravelerId },
    );
    if (ok) {
      setMessage(t("roomAssignmentsHaveBeenUpdated"));
      setInitialRoomId(null);
      setInitialTravelerId(null);
      await refresh();
    }
  }

  function selectChange(setter: (key: string | null) => void) {
    return (key: string | number | null) => setter(key ? String(key) : null);
  }

  if (status === "loading")
    return (
      <section className="grid gap-4" aria-busy="true">
        <p role="status">{t("loadingRoomAssignments")}</p>
      </section>
    );
  if (status === "error")
    return (
      <section className="grid gap-4">
        <h3 className="text-lg font-bold">{t("rooms")}</h3>
        <p role="alert">{t("roomAssignmentsAreTemporarilyUnavailable")}</p>
      </section>
    );
  return (
    <section className="grid gap-5" aria-labelledby="rooming-title">
      <div className="flex items-start justify-between gap-4 max-[420px]:flex-col">
        <div className="grid gap-1">
          <h3 className="text-lg font-bold" id="rooming-title">
            {t("rooms")}
          </h3>
          <p className="text-sm leading-relaxed text-content-muted">
            {t("yourRoomAndPendingRequests")}
          </p>
        </div>
      </div>
      {ownRoom ? (
        <article className="grid content-start gap-3 rounded-card border border-border bg-surface p-4">
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
          <ul className="list-inside list-disc space-y-1 leading-relaxed text-content-muted">
            {ownRoom.occupants.map((person) => (
              <li key={person.userId}>
                {person.firstName} {person.lastName}
                {person.userId === userId ? ` · ${t("you")}` : ""}
              </li>
            ))}
          </ul>
        </article>
      ) : (
        <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
          {t("youHaveNotBeenAssignedARoomYet")}
        </p>
      )}
      {isStaff && (
        <div className="grid gap-3">
          <h4 className="text-base font-bold">{t("currentRoomAssignments")}</h4>
          {rooms.map((room) => (
            <article
              className="grid content-start gap-3 rounded-card border border-border bg-surface p-4"
              key={room.id}
            >
              <div className="grid gap-2">
                <span className="text-xs text-content-subtle">
                  {t("occupiedCapacityBeds", {
                    occupied: room.occupiedCount,
                    capacity: room.capacity,
                  })}
                  {room.genderPolicy === "mixed"
                    ? ` · ${t("approvedMixedRoom")}`
                    : ""}
                </span>
                <strong className="text-lg">{room.name}</strong>
              </div>
              {room.occupants.length ? (
                <ul className="list-inside list-disc space-y-1 leading-relaxed text-content-muted">
                  {room.occupants.map((person) => (
                    <li key={person.userId}>
                      {person.firstName} {person.lastName}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-content-subtle">{t("emptyRoom")}</p>
              )}
            </article>
          ))}
        </div>
      )}
      {targetRooms.length > 0 && (
        <Form
          className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 max-[420px]:grid-cols-1"
          onSubmit={requestChange}
        >
          <Select
            className="grid min-w-0 gap-2"
            selectedKey={targetRoomId}
            onSelectionChange={(key) =>
              setTargetRoomId(key ? String(key) : null)
            }
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
              <Input
                className={textFieldStyles().input()}
                autoComplete="email"
              />
            </TextField>
          )}
          <Button type="submit" appearance="secondary">
            {exchangeEmail.trim() ? t("proposeAnExchange") : t("sendMyRequest")}
          </Button>
        </Form>
      )}
      {requests.length > 0 && (
        <div className="grid gap-3">
          <h4 className="text-base font-bold">{t("requestsToApprove")}</h4>
          {requests.map((request) => {
            const ownConsent = request.requiredConsents.find(
              (consent) => consent.userId === userId,
            );
            return (
              <article
                className="grid gap-3 rounded-card border border-border bg-surface p-4"
                key={request.id}
              >
                <p className="leading-relaxed text-content-muted">
                  {request.requester?.firstName} {request.requester?.lastName}{" "}
                  {t("requestsARoomChange")}
                </p>
                <ul className="list-inside list-disc space-y-1 leading-relaxed text-content-muted">
                  {request.moves.map((move) => (
                    <li key={move.userId}>
                      {move.person?.firstName} {move.person?.lastName} :{" "}
                      {move.currentRoom ?? t("unassigned")} → {move.targetRoom}
                    </li>
                  ))}
                </ul>
                {ownConsent && !ownConsent.approved && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      appearance="secondary"
                      onPress={() => void respond(request.id, true)}
                    >
                      {t("approve")}
                    </Button>
                    <Button
                      appearance="quiet"
                      onPress={() => void respond(request.id, false)}
                    >
                      {t("decline")}
                    </Button>
                  </div>
                )}
                {ownConsent?.approved && (
                  <p className="text-sm text-success">
                    {t("yourApprovalIsRecorded")} ·{" "}
                    {
                      request.requiredConsents.filter(
                        (consent) => consent.approved,
                      ).length
                    }
                    /{request.requiredConsents.length} {t("approvals")}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {isStaff && (
        <div className="grid gap-4">
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
              <Label className={textFieldStyles().label()}>
                {t("roomName")}
              </Label>
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
              <Label className={textFieldStyles().label()}>
                {t("capacity")}
              </Label>
              <Input
                className={textFieldStyles().input()}
                type="number"
                min="1"
                max="12"
              />
            </TextField>
            <Button appearance="secondary" type="submit">
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
                selectedKey={initialTravelerId}
                onSelectionChange={selectChange(setInitialTravelerId)}
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
                selectedKey={initialRoomId}
                onSelectionChange={selectChange(setInitialRoomId)}
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
              <Button appearance="secondary" type="submit">
                {t("assign2")}
              </Button>
            </Form>
          )}
        </div>
      )}
      {message && (
        <p className={messageStyles()} role="status">
          {message}
        </p>
      )}
    </section>
  );
}

const roomErrorLabel: Record<string, string> = {
  room_capacity_exceeded: "thisRoomIsFull",
  room_composition_changed: "theRoomCompositionHasChangedRefreshThePage",
  room_change_requires_consents:
    "aRoomChangeRequiresTheConsentOfEveryoneInvolved",
  consent_not_required: "youAreNotInvolvedInThisRequest",
  invalid_room_exchange: "thisPersonCouldNotBeFoundInTheSelectedRoom",
};
