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
import {
  Button,
  listBoxStyles,
  messageStyles,
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
      setMessage(roomErrorLabel[result.error ?? ""] ?? "L’opération a échoué.");
      return false;
    }
    return true;
  }

  async function requestChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetRoomId) return;
    if (exchangeRequired && !exchangeEmail.trim()) {
      setMessage("Indiquez l’e-mail de la personne avec qui échanger.");
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
          ? "Votre proposition d’échange a été envoyée aux personnes concernées."
          : "Votre demande de chambre a été enregistrée.",
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
          roomErrorLabel[result.error ?? ""] ?? "L’opération a échoué.",
        );
        return;
      }
      setMessage(
        result.status === "stale"
          ? "La composition de la chambre a changé. Cette demande n’a pas été appliquée."
          : approve
            ? "Votre accord a été enregistré."
            : "La demande a été refusée.",
      );
      await refresh();
    } catch {
      setMessage(
        "Votre réponse n’a pas pu être envoyée. Vérifiez votre connexion puis réessayez.",
      );
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
      setMessage(
        "Impossible de créer cette chambre. Vérifiez son nom et sa capacité.",
      );
      return;
    }
    setRoomName("");
    setRoomCapacity("4");
    setMessage("La chambre a été créée.");
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
      setMessage("La répartition a été mise à jour.");
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
      <section className="mt-7" aria-busy="true">
        <p role="status">Chargement du rooming…</p>
      </section>
    );
  if (status === "error")
    return (
      <section className="mt-7">
        <h3 className="mb-1 text-lg font-bold">Chambres</h3>
        <p role="alert">
          La répartition des chambres est momentanément indisponible.
        </p>
      </section>
    );
  return (
    <section className="mt-7" aria-labelledby="rooming-title">
      <div className="mb-5 flex items-start justify-between gap-4 max-[420px]:flex-col">
        <div>
          <h3 className="mb-1 text-lg font-bold" id="rooming-title">
            Chambres
          </h3>
          <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
            Votre chambre et les demandes en attente.
          </p>
        </div>
      </div>
      {ownRoom ? (
        <article className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="grid gap-2">
            <span className="text-xs text-[var(--quiet)]">Votre chambre</span>
            <strong className="text-lg">{ownRoom.name}</strong>
          </div>
          <span className="mt-3 inline-block rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
            {ownRoom.occupiedCount}/{ownRoom.capacity} places
          </span>
          <ul className="mb-0 mt-3 list-inside list-disc space-y-1 leading-relaxed text-[var(--muted)]">
            {ownRoom.occupants.map((person) => (
              <li key={person.userId}>
                {person.firstName} {person.lastName}
                {person.userId === userId ? " · vous" : ""}
              </li>
            ))}
          </ul>
        </article>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
          Aucune chambre ne vous a encore été attribuée.
        </p>
      )}
      {isStaff && (
        <div className="mt-6 grid gap-3">
          <h4 className="mb-0 text-base font-bold">Répartition actuelle</h4>
          {rooms.map((room) => (
            <article
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
              key={room.id}
            >
              <div className="grid gap-2">
                <span className="text-xs text-[var(--quiet)]">
                  {room.occupiedCount}/{room.capacity} places
                  {room.genderPolicy === "mixed" ? " · mixte validée" : ""}
                </span>
                <strong className="text-lg">{room.name}</strong>
              </div>
              {room.occupants.length ? (
                <ul className="mb-0 mt-3 list-inside list-disc space-y-1 leading-relaxed text-[var(--muted)]">
                  {room.occupants.map((person) => (
                    <li key={person.userId}>
                      {person.firstName} {person.lastName}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-0 mt-3 text-xs text-[var(--quiet)]">
                  Chambre vide
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      {targetRooms.length > 0 && (
        <Form
          className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 max-[420px]:grid-cols-1"
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
              Demander une place dans une autre chambre
            </Label>
            <Button appearance="select">
              <SelectValue />
            </Button>
            <Popover>
              <ListBox className={listBoxStyles().list()}>
                {targetRooms.map((room) => (
                  <ListBoxItem
                    className={listBoxStyles().item()}
                    key={room.id}
                    id={room.id}
                    textValue={room.name}
                  >
                    {room.name} · {room.capacity - room.occupiedCount} place(s)
                    libre(s)
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
                E-mail de la personne avec qui échanger
                {exchangeRequired ? " (obligatoire)" : " (facultatif)"}
              </Label>
              <Input
                className={textFieldStyles().input()}
                autoComplete="email"
              />
            </TextField>
          )}
          <Button type="submit" appearance="secondary">
            {exchangeEmail.trim() ? "Proposer l’échange" : "Envoyer ma demande"}
          </Button>
        </Form>
      )}
      {requests.length > 0 && (
        <div className="mt-7">
          <h4 className="mb-2 text-base font-bold">Demandes à valider</h4>
          {requests.map((request) => {
            const ownConsent = request.requiredConsents.find(
              (consent) => consent.userId === userId,
            );
            return (
              <article
                className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
                key={request.id}
              >
                <p className="m-0 leading-relaxed text-[var(--muted)]">
                  {request.requester?.firstName} {request.requester?.lastName}{" "}
                  demande un changement de chambre.
                </p>
                <ul className="mb-0 mt-3 list-inside list-disc space-y-1 leading-relaxed text-[var(--muted)]">
                  {request.moves.map((move) => (
                    <li key={move.userId}>
                      {move.person?.firstName} {move.person?.lastName} :{" "}
                      {move.currentRoom ?? "sans chambre"} → {move.targetRoom}
                    </li>
                  ))}
                </ul>
                {ownConsent && !ownConsent.approved && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      appearance="secondary"
                      onPress={() => void respond(request.id, true)}
                    >
                      J’accepte
                    </Button>
                    <Button
                      appearance="quiet"
                      onPress={() => void respond(request.id, false)}
                    >
                      Je refuse
                    </Button>
                  </div>
                )}
                {ownConsent?.approved && (
                  <p className="mt-3 text-sm text-[var(--success)]">
                    Votre accord est enregistré ·{" "}
                    {
                      request.requiredConsents.filter(
                        (consent) => consent.approved,
                      ).length
                    }
                    /{request.requiredConsents.length} accords
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {isStaff && (
        <div className="mt-7">
          <h4 className="mb-2 text-base font-bold">Créer une chambre</h4>
          <Form
            className="mt-4 grid grid-cols-[repeat(2,minmax(0,1fr))_auto] items-end gap-3 max-[420px]:grid-cols-1"
            onSubmit={createRoom}
          >
            <TextField
              className="grid min-w-0 gap-2"
              value={roomName}
              onChange={setRoomName}
              isRequired
            >
              <Label className={textFieldStyles().label()}>
                Nom de la chambre
              </Label>
              <Input
                className={textFieldStyles().input()}
                placeholder="Ex. 101"
                maxLength={80}
              />
            </TextField>
            <TextField
              className="grid min-w-0 gap-2"
              value={roomCapacity}
              onChange={setRoomCapacity}
              isRequired
            >
              <Label className={textFieldStyles().label()}>Capacité</Label>
              <Input
                className={textFieldStyles().input()}
                type="number"
                min="1"
                max="12"
              />
            </TextField>
            <Button appearance="secondary" type="submit">
              Créer
            </Button>
          </Form>
          {unassignedTravelers.length > 0 && availableRooms.length > 0 && (
            <Form
              className="mt-4 grid grid-cols-[repeat(2,minmax(0,1fr))_auto] items-end gap-3 max-[420px]:grid-cols-1"
              onSubmit={assignInitialRoom}
            >
              <Select
                selectedKey={initialTravelerId}
                onSelectionChange={selectChange(setInitialTravelerId)}
                isRequired
              >
                <Label className={textFieldStyles().label()}>
                  Voyageur à placer
                </Label>
                <Button appearance="select">
                  <SelectValue />
                </Button>
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
                selectedKey={initialRoomId}
                onSelectionChange={selectChange(setInitialRoomId)}
                isRequired
              >
                <Label className={textFieldStyles().label()}>
                  Chambre avec une place libre
                </Label>
                <Button appearance="select">
                  <SelectValue />
                </Button>
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
                Attribuer
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
  room_capacity_exceeded: "Cette chambre n’a plus de place.",
  room_composition_changed:
    "La composition de la chambre a changé. Actualisez la page.",
  room_change_requires_consents:
    "Un changement de chambre nécessite le consentement des personnes concernées.",
  consent_not_required: "Vous n’êtes pas concerné par cette demande.",
  invalid_room_exchange:
    "Impossible de retrouver cette personne dans la chambre sélectionnée.",
};
