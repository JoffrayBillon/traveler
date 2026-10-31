import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  Button,
  Checkbox,
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
import { ParticipantAccess } from "./ParticipantAccess";
import type { StaffTraveler } from "./types";

type TravelerDetailsDraft = {
  activityProfile: "ski" | "spa" | null;
  skiDayThree: boolean;
  transportMode: "train" | "flight" | "none" | null;
  departureCity: string | null;
  outboundDateTime: string | null;
  outboundTimezone: string | null;
  outboundMeetingTime: string | null;
  outboundDepartureTime: string | null;
  outboundLocation: string | null;
  outboundReference: string | null;
  outboundSeat: string | null;
  returnDateTime: string | null;
  returnTimezone: string | null;
  returnMeetingTime: string | null;
  returnDepartureTime: string | null;
  returnLocation: string | null;
  returnReference: string | null;
  returnSeat: string | null;
  carpoolPreference: boolean | null;
  parkingPreference: boolean | null;
};

export function StaffTools({
  tripId,
  tripName,
  isManager,
  onTripNameChange,
}: {
  tripId: string;
  tripName: string;
  isManager: boolean;
  onTripNameChange: (name: string) => void;
}) {
  const [travelers, setTravelers] = useState<StaffTraveler[]>([]);
  const [travelerId, setTravelerId] = useState<string | null>(null);
  const [detailsTravelerId, setDetailsTravelerId] = useState<string | null>(
    null,
  );
  const [detailsDraft, setDetailsDraft] = useState<TravelerDetailsDraft | null>(
    null,
  );
  const [ticketKind, setTicketKind] = useState<string | null>(null);
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [editableTripName, setEditableTripName] = useState(tripName);
  const [companionFirstName, setCompanionFirstName] = useState("");
  const [companionLastName, setCompanionLastName] = useState("");
  const [companionEmail, setCompanionEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setEditableTripName(tripName);
  }, [tripName]);

  const refreshTravelers = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/travelers`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const data = (await response.json()) as { travelers: StaffTraveler[] };
      setTravelers(data.travelers);
    } catch {
      setMessage(
        "La liste des voyageurs ne peut pas être chargée pour le moment.",
      );
    }
  }, [tripId]);

  useEffect(() => {
    void refreshTravelers();
  }, [refreshTravelers]);

  async function uploadTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!travelerId || !ticketKind || !ticketFile) return;
    if (ticketFile.size > 4 * 1024 * 1024) {
      setMessage("Le fichier dépasse la limite de 4 Mo.");
      return;
    }
    const form = new FormData();
    form.set("file", ticketFile);
    form.set("kind", ticketKind);
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(travelerId)}/tickets`,
      { method: "POST", body: form },
    );
    if (!response.ok) {
      setMessage(
        response.status === 503
          ? "Le stockage de billets n’est pas configuré sur cet environnement."
          : "Le billet n’a pas pu être téléversé. Vérifiez le type et la taille du fichier.",
      );
      return;
    }
    setTicketFile(null);
    setMessage("Le titre de transport a été ajouté.");
  }

  async function importParticipants(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importFile) return;
    if (importFile.size > 4 * 1024 * 1024) {
      setMessage("Le classeur Excel ne doit pas dépasser 4 Mo.");
      return;
    }
    const form = new FormData();
    form.set("file", importFile);
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/participants/import`,
      { method: "POST", body: form },
    );
    const result = (await response.json().catch(() => ({}))) as {
      created?: number;
      updated?: number;
      errors?: { row: number; field: string; message: string }[];
    };
    if (!response.ok) {
      setMessage(
        result.errors
          ?.map(
            (error) => `Ligne ${error.row} · ${error.field} : ${error.message}`,
          )
          .join("\n") ?? "L’import du fichier a échoué.",
      );
      return;
    }
    setMessage(
      `${result.created ?? 0} participant(s) ajouté(s), ${result.updated ?? 0} mis à jour. Les billets et affectations déjà gérés sont conservés.`,
    );
    setImportFile(null);
    await refreshTravelers();
  }

  async function saveTripName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editableTripName }),
    });
    if (!response.ok) {
      setMessage("Le nom du voyage n’a pas pu être mis à jour.");
      return;
    }
    onTripNameChange(editableTripName.trim());
    setMessage("Le nom du voyage a été mis à jour.");
  }

  async function appointCompanion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/companions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: companionFirstName,
          lastName: companionLastName,
          email: companionEmail,
        }),
      },
    );
    if (!response.ok) {
      setMessage("L’accompagnateur n’a pas pu être ajouté.");
      return;
    }
    setCompanionFirstName("");
    setCompanionLastName("");
    setCompanionEmail("");
    setMessage(
      "L’accompagnateur peut maintenant demander son lien de connexion.",
    );
    await refreshTravelers();
  }

  function changeDetails<Key extends keyof TravelerDetailsDraft>(
    key: Key,
    value: TravelerDetailsDraft[Key],
  ) {
    setDetailsDraft((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  async function saveTravelerDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailsTravelerId || !detailsDraft) return;
    const savedDetails =
      detailsDraft.transportMode === "none"
        ? {
            ...detailsDraft,
            departureCity: null,
            outboundDateTime: null,
            outboundTimezone: null,
            outboundMeetingTime: null,
            outboundDepartureTime: null,
            outboundLocation: null,
            outboundReference: null,
            outboundSeat: null,
            returnDateTime: null,
            returnTimezone: null,
            returnMeetingTime: null,
            returnDepartureTime: null,
            returnLocation: null,
            returnReference: null,
            returnSeat: null,
          }
        : {
            ...detailsDraft,
            carpoolPreference: null,
            parkingPreference: null,
          };
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(detailsTravelerId)}/details`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedDetails),
      },
    );
    if (!response.ok) {
      setMessage(
        "Les informations de voyage n’ont pas pu être enregistrées. Vérifiez que le ski J3 est réservé aux skieurs.",
      );
      return;
    }
    setMessage("Les informations de voyage ont été mises à jour.");
    await refreshTravelers();
  }

  function selectDetailsTraveler(key: string | number | null) {
    const nextId = key ? String(key) : null;
    const traveler = travelers.find((person) => person.userId === nextId);
    setDetailsTravelerId(nextId);
    setDetailsDraft(
      traveler
        ? {
            activityProfile: traveler.activityProfile,
            skiDayThree: traveler.skiDayThree,
            transportMode: traveler.transportMode,
            departureCity: traveler.departureCity,
            outboundDateTime: traveler.outboundDateTime,
            outboundTimezone: traveler.outboundTimezone,
            outboundMeetingTime: traveler.outboundMeetingTime,
            outboundDepartureTime: traveler.outboundDepartureTime,
            outboundLocation: traveler.outboundLocation,
            outboundReference: traveler.outboundReference,
            outboundSeat: traveler.outboundSeat,
            returnDateTime: traveler.returnDateTime,
            returnTimezone: traveler.returnTimezone,
            returnMeetingTime: traveler.returnMeetingTime,
            returnDepartureTime: traveler.returnDepartureTime,
            returnLocation: traveler.returnLocation,
            returnReference: traveler.returnReference,
            returnSeat: traveler.returnSeat,
            carpoolPreference: traveler.carpoolPreference,
            parkingPreference: traveler.parkingPreference,
          }
        : null,
    );
  }

  return (
    <section className="staff-tools" aria-labelledby="staff-tools-title">
      <div className="section-heading">
        <div>
          <h3 id="staff-tools-title">Outils d’organisation</h3>
          <p>Transport, rooming et données des participants.</p>
        </div>
      </div>
      <Form className="staff-tool-card" onSubmit={uploadTicket}>
        <h4>Ajouter un titre de transport</h4>
        <Select
          selectedKey={travelerId}
          onSelectionChange={(key) => setTravelerId(key ? String(key) : null)}
          isRequired
        >
          <Label>Voyageur</Label>
          <Button className="select-trigger">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className="room-select-listbox">
              {travelers.map((person) => (
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
          selectedKey={ticketKind}
          onSelectionChange={(key) => setTicketKind(key ? String(key) : null)}
          isRequired
        >
          <Label>Trajet</Label>
          <Button className="select-trigger">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className="room-select-listbox">
              <ListBoxItem className="room-select-option" id="outbound">
                Aller
              </ListBoxItem>
              <ListBoxItem className="room-select-option" id="return">
                Retour
              </ListBoxItem>
              <ListBoxItem className="room-select-option" id="other">
                Autre document
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        <label className="file-picker">
          Fichier PDF, PNG ou JPEG (4 Mo max)
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => setTicketFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <Button className="secondary-action" type="submit">
          Téléverser le billet
        </Button>
      </Form>
      <Form className="staff-tool-card" onSubmit={saveTravelerDetails}>
        <h4>Informations de voyageur et de transport</h4>
        <Select
          selectedKey={detailsTravelerId}
          onSelectionChange={selectDetailsTraveler}
          isRequired
        >
          <Label>Voyageur à mettre à jour</Label>
          <Button className="select-trigger">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className="room-select-listbox">
              {travelers.map((person) => (
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
          selectedKey={detailsDraft?.activityProfile ?? null}
          onSelectionChange={(key) => {
            if (key === "spa") changeDetails("skiDayThree", false);
            changeDetails(
              "activityProfile",
              key === "ski" || key === "spa" ? key : null,
            );
          }}
          isDisabled={!detailsDraft}
        >
          <Label>Formule</Label>
          <Button className="select-trigger">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className="room-select-listbox">
              <ListBoxItem className="room-select-option" id="ski">
                Ski
              </ListBoxItem>
              <ListBoxItem className="room-select-option" id="spa">
                Spa
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        {detailsDraft?.activityProfile === "ski" && (
          <Checkbox
            isSelected={detailsDraft.skiDayThree}
            onChange={(checked) => changeDetails("skiDayThree", checked)}
          >
            Ski le troisième jour
          </Checkbox>
        )}
        <Select
          selectedKey={detailsDraft?.transportMode ?? null}
          onSelectionChange={(key) =>
            changeDetails(
              "transportMode",
              key === "train" || key === "flight" || key === "none"
                ? key
                : null,
            )
          }
          isDisabled={!detailsDraft}
        >
          <Label>Transport réservé</Label>
          <Button className="select-trigger">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className="room-select-listbox">
              <ListBoxItem className="room-select-option" id="train">
                Train
              </ListBoxItem>
              <ListBoxItem className="room-select-option" id="flight">
                Avion
              </ListBoxItem>
              <ListBoxItem className="room-select-option" id="none">
                Aucun
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        {detailsDraft && detailsDraft.transportMode !== "none" && (
          <>
            <TextField
              value={detailsDraft.departureCity ?? ""}
              onChange={(value) =>
                changeDetails("departureCity", value || null)
              }
              isDisabled={!detailsDraft}
            >
              <Label>Ville de départ</Label>
              <Input />
            </TextField>
            <div className="staff-leg-fields">
              <h5>Aller</h5>
              <TextField
                value={detailsDraft.outboundDateTime ?? ""}
                onChange={(value) =>
                  changeDetails("outboundDateTime", value || null)
                }
              >
                <Label>Date et heure</Label>
                <Input type="datetime-local" />
              </TextField>
              <TextField
                value={detailsDraft.outboundTimezone ?? ""}
                onChange={(value) =>
                  changeDetails("outboundTimezone", value || null)
                }
              >
                <Label>Fuseau horaire</Label>
                <Input placeholder="Europe/Paris" />
              </TextField>
              <TextField
                value={detailsDraft.outboundMeetingTime ?? ""}
                onChange={(value) =>
                  changeDetails("outboundMeetingTime", value || null)
                }
              >
                <Label>Heure de rendez-vous</Label>
                <Input type="time" />
              </TextField>
              <TextField
                value={detailsDraft.outboundDepartureTime ?? ""}
                onChange={(value) =>
                  changeDetails("outboundDepartureTime", value || null)
                }
              >
                <Label>Heure de départ</Label>
                <Input type="time" />
              </TextField>
              <TextField
                value={detailsDraft.outboundLocation ?? ""}
                onChange={(value) =>
                  changeDetails("outboundLocation", value || null)
                }
              >
                <Label>Lieu / gare</Label>
                <Input />
              </TextField>
              <TextField
                value={detailsDraft.outboundReference ?? ""}
                onChange={(value) =>
                  changeDetails("outboundReference", value || null)
                }
              >
                <Label>Référence</Label>
                <Input />
              </TextField>
              <TextField
                value={detailsDraft.outboundSeat ?? ""}
                onChange={(value) =>
                  changeDetails("outboundSeat", value || null)
                }
              >
                <Label>Place</Label>
                <Input />
              </TextField>
            </div>
            <div className="staff-leg-fields">
              <h5>Retour</h5>
              <TextField
                value={detailsDraft.returnDateTime ?? ""}
                onChange={(value) =>
                  changeDetails("returnDateTime", value || null)
                }
              >
                <Label>Date et heure</Label>
                <Input type="datetime-local" />
              </TextField>
              <TextField
                value={detailsDraft.returnTimezone ?? ""}
                onChange={(value) =>
                  changeDetails("returnTimezone", value || null)
                }
              >
                <Label>Fuseau horaire</Label>
                <Input placeholder="Europe/Paris" />
              </TextField>
              <TextField
                value={detailsDraft.returnMeetingTime ?? ""}
                onChange={(value) =>
                  changeDetails("returnMeetingTime", value || null)
                }
              >
                <Label>Heure de rendez-vous</Label>
                <Input type="time" />
              </TextField>
              <TextField
                value={detailsDraft.returnDepartureTime ?? ""}
                onChange={(value) =>
                  changeDetails("returnDepartureTime", value || null)
                }
              >
                <Label>Heure de départ</Label>
                <Input type="time" />
              </TextField>
              <TextField
                value={detailsDraft.returnLocation ?? ""}
                onChange={(value) =>
                  changeDetails("returnLocation", value || null)
                }
              >
                <Label>Lieu / gare</Label>
                <Input />
              </TextField>
              <TextField
                value={detailsDraft.returnReference ?? ""}
                onChange={(value) =>
                  changeDetails("returnReference", value || null)
                }
              >
                <Label>Référence</Label>
                <Input />
              </TextField>
              <TextField
                value={detailsDraft.returnSeat ?? ""}
                onChange={(value) => changeDetails("returnSeat", value || null)}
              >
                <Label>Place</Label>
                <Input />
              </TextField>
            </div>
          </>
        )}
        <Button
          className="secondary-action"
          type="submit"
          isDisabled={!detailsTravelerId || !detailsDraft}
        >
          Enregistrer les informations
        </Button>
      </Form>
      {isManager && (
        <>
          <ParticipantAccess tripId={tripId} />
          <Form className="staff-tool-card" onSubmit={saveTripName}>
            <h4>Informations du voyage</h4>
            <TextField
              value={editableTripName}
              onChange={setEditableTripName}
              isRequired
            >
              <Label>Nom du voyage</Label>
              <Input maxLength={120} />
            </TextField>
            <Button className="secondary-action" type="submit">
              Enregistrer
            </Button>
          </Form>
          <Form className="staff-tool-card" onSubmit={appointCompanion}>
            <h4>Nommer un accompagnateur</h4>
            <TextField
              value={companionFirstName}
              onChange={setCompanionFirstName}
              isRequired
            >
              <Label>Prénom</Label>
              <Input autoComplete="given-name" />
            </TextField>
            <TextField
              value={companionLastName}
              onChange={setCompanionLastName}
              isRequired
            >
              <Label>Nom</Label>
              <Input autoComplete="family-name" />
            </TextField>
            <TextField
              type="email"
              value={companionEmail}
              onChange={setCompanionEmail}
              isRequired
            >
              <Label>Adresse e-mail</Label>
              <Input autoComplete="email" />
            </TextField>
            <Button className="secondary-action" type="submit">
              Ajouter l’accompagnateur
            </Button>
          </Form>
          <Form className="staff-tool-card" onSubmit={importParticipants}>
            <h4>Importer les participants</h4>
            <p>
              Import `.xlsx` jusqu’à 500 lignes. Une erreur bloque toute
              l’importation; une réimportation conserve les billets et chambres
              déjà gérés.
            </p>
            <a
              className="ticket-download"
              href={`/api/trips/${encodeURIComponent(tripId)}/participants/template`}
            >
              Télécharger le modèle Excel
            </a>
            <label className="file-picker">
              Classeur participants .xlsx
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) =>
                  setImportFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <Button className="secondary-action" type="submit">
              Valider et importer
            </Button>
          </Form>
          <a
            className="ticket-download"
            href={`/api/trips/${encodeURIComponent(tripId)}/rooms/export`}
          >
            Exporter le rooming Excel
          </a>
        </>
      )}
      {message && (
        <p className="form-message" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}
