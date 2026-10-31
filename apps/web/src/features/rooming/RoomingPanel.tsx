import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  Button,
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
  const isStaff = role !== "traveler";

  const refresh = useCallback(async () => {
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
      setRooms(roomData.rooms);
      setRequests(
        ((await requestResponse.json()) as { requests: RoomRequestSummary[] })
          .requests,
      );
      if (travelerResponse) {
        const data = (await travelerResponse.json()) as {
          travelers: StaffTraveler[];
        };
        const assigned = new Set(
          roomData.rooms.flatMap((room) =>
            room.occupants.map((occupant) => occupant.userId),
          ),
        );
        setUnassignedTravelers(
          data.travelers.filter((person) => !assigned.has(person.userId)),
        );
      }
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [tripId, isStaff]);

  useEffect(() => {
    void refresh();
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
    const ok = await post(
      `/api/trips/${encodeURIComponent(tripId)}/room-requests/${encodeURIComponent(requestId)}/consent`,
      { approve },
    );
    if (ok) {
      setMessage(
        approve
          ? "Votre accord a été enregistré."
          : "La demande a été refusée.",
      );
      await refresh();
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
      <section className="rooming-section" aria-busy="true">
        <p role="status">Chargement du rooming…</p>
      </section>
    );
  if (status === "error")
    return (
      <section className="rooming-section">
        <h3>Chambres</h3>
        <p role="alert">
          La répartition des chambres est momentanément indisponible.
        </p>
      </section>
    );
  return (
    <section className="rooming-section" aria-labelledby="rooming-title">
      <div className="section-heading">
        <div>
          <h3 id="rooming-title">Chambres</h3>
          <p>Votre chambre et les demandes en attente.</p>
        </div>
      </div>
      {ownRoom ? (
        <article className="room-card">
          <div>
            <span className="detail-label">Votre chambre</span>
            <strong>{ownRoom.name}</strong>
          </div>
          <span className="count-pill">
            {ownRoom.occupiedCount}/{ownRoom.capacity} places
          </span>
          <ul>
            {ownRoom.occupants.map((person) => (
              <li key={person.userId}>
                {person.firstName} {person.lastName}
                {person.userId === userId ? " · vous" : ""}
              </li>
            ))}
          </ul>
        </article>
      ) : (
        <p className="empty-state">
          Aucune chambre ne vous a encore été attribuée.
        </p>
      )}
      {isStaff && (
        <div className="room-admin-list">
          <h4>Répartition actuelle</h4>
          {rooms.map((room) => (
            <article className="room-card" key={room.id}>
              <div>
                <span className="detail-label">
                  {room.occupiedCount}/{room.capacity} places
                  {room.genderPolicy === "mixed" ? " · mixte validée" : ""}
                </span>
                <strong>{room.name}</strong>
              </div>
              {room.occupants.length ? (
                <ul>
                  {room.occupants.map((person) => (
                    <li key={person.userId}>
                      {person.firstName} {person.lastName}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="detail-label">Chambre vide</p>
              )}
            </article>
          ))}
        </div>
      )}
      {targetRooms.length > 0 && (
        <Form className="room-request-form" onSubmit={requestChange}>
          <Select
            className="room-select"
            selectedKey={targetRoomId}
            onSelectionChange={(key) =>
              setTargetRoomId(key ? String(key) : null)
            }
            isRequired
          >
            <Label>Demander une place dans une autre chambre</Label>
            <Button className="select-trigger">
              <SelectValue />
            </Button>
            <Popover>
              <ListBox className="room-select-listbox">
                {targetRooms.map((room) => (
                  <ListBoxItem
                    className="room-select-option"
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
              type="email"
              value={exchangeEmail}
              onChange={setExchangeEmail}
            >
              <Label>
                E-mail de la personne avec qui échanger (si la chambre est
                complète)
              </Label>
              <Input autoComplete="email" />
            </TextField>
          )}
          <Button type="submit" className="secondary-action">
            {exchangeEmail.trim() ? "Proposer l’échange" : "Envoyer ma demande"}
          </Button>
        </Form>
      )}
      {requests.length > 0 && (
        <div className="room-requests">
          <h4>Demandes à valider</h4>
          {requests.map((request) => {
            const ownConsent = request.requiredConsents.find(
              (consent) => consent.userId === userId,
            );
            return (
              <article className="request-card" key={request.id}>
                <p>
                  {request.requester?.firstName} {request.requester?.lastName}{" "}
                  demande un changement de chambre.
                </p>
                <ul>
                  {request.moves.map((move) => (
                    <li key={move.userId}>
                      {move.person?.firstName} {move.person?.lastName} :{" "}
                      {move.currentRoom ?? "sans chambre"} → {move.targetRoom}
                    </li>
                  ))}
                </ul>
                {ownConsent && !ownConsent.approved && (
                  <div className="request-actions">
                    <Button
                      className="secondary-action"
                      onPress={() => void respond(request.id, true)}
                    >
                      J’accepte
                    </Button>
                    <Button
                      className="text-action"
                      onPress={() => void respond(request.id, false)}
                    >
                      Je refuse
                    </Button>
                  </div>
                )}
                {ownConsent?.approved && (
                  <p className="consent-state">
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
        <div className="room-admin">
          <h4>Créer une chambre</h4>
          <Form className="room-request-form" onSubmit={createRoom}>
            <TextField value={roomName} onChange={setRoomName} isRequired>
              <Label>Nom de la chambre</Label>
              <Input placeholder="Ex. 101" maxLength={80} />
            </TextField>
            <TextField
              value={roomCapacity}
              onChange={setRoomCapacity}
              isRequired
            >
              <Label>Capacité</Label>
              <Input type="number" min="1" max="12" />
            </TextField>
            <Button className="secondary-action" type="submit">
              Créer
            </Button>
          </Form>
          {unassignedTravelers.length > 0 && availableRooms.length > 0 && (
            <Form className="room-request-form" onSubmit={assignInitialRoom}>
              <Select
                selectedKey={initialTravelerId}
                onSelectionChange={selectChange(setInitialTravelerId)}
                isRequired
              >
                <Label>Voyageur à placer</Label>
                <Button className="select-trigger">
                  <SelectValue />
                </Button>
                <Popover>
                  <ListBox className="room-select-listbox">
                    {unassignedTravelers.map((person) => (
                      <ListBoxItem
                        className="room-select-option"
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
                <Label>Chambre avec une place libre</Label>
                <Button className="select-trigger">
                  <SelectValue />
                </Button>
                <Popover>
                  <ListBox className="room-select-listbox">
                    {availableRooms.map((room) => (
                      <ListBoxItem
                        className="room-select-option"
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
              <Button className="secondary-action" type="submit">
                Attribuer
              </Button>
            </Form>
          )}
        </div>
      )}
      {message && (
        <p className="form-message" role="status">
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
