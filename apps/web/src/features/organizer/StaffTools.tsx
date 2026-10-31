import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
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
import {
  Button,
  buttonStyles,
  checkboxStyles,
  listBoxStyles,
  messageStyles,
  textFieldStyles,
} from "../../components/ui";
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
    if (!travelerId || !ticketKind) {
      setMessage("Choisissez un voyageur et un trajet avant de téléverser.");
      return;
    }
    if (!ticketFile) {
      setMessage("Choisissez un fichier de billet à téléverser.");
      return;
    }
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
    if (!importFile) {
      setMessage("Choisissez un classeur Excel à importer.");
      return;
    }
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
            skiDayThree: traveler.skiDayThree ?? false,
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
    <section className="mt-7" aria-labelledby="staff-tools-title">
      <div className="mb-5 flex items-start justify-between gap-4 max-[420px]:flex-col">
        <div>
          <h3 className="mb-1 text-lg font-bold" id="staff-tools-title">
            Outils d’organisation
          </h3>
          <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
            Transport, rooming et données des participants.
          </p>
        </div>
      </div>
      <Form
        className="my-3 grid grid-cols-2 items-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 max-[420px]:grid-cols-1"
        onSubmit={uploadTicket}
      >
        <h4 className="col-span-full mb-0 text-base font-bold">
          Ajouter un titre de transport
        </h4>
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={travelerId}
          onSelectionChange={(key) => setTravelerId(key ? String(key) : null)}
          isRequired
        >
          <Label className={textFieldStyles().label()}>Voyageur</Label>
          <Button appearance="select">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className={listBoxStyles().list()}>
              {travelers.map((person) => (
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
          selectedKey={ticketKind}
          onSelectionChange={(key) => setTicketKind(key ? String(key) : null)}
          isRequired
        >
          <Label className={textFieldStyles().label()}>Trajet</Label>
          <Button appearance="select">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className={listBoxStyles().list()}>
              <ListBoxItem className={listBoxStyles().item()} id="outbound">
                Aller
              </ListBoxItem>
              <ListBoxItem className={listBoxStyles().item()} id="return">
                Retour
              </ListBoxItem>
              <ListBoxItem className={listBoxStyles().item()} id="other">
                Autre document
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        <label className="col-span-full grid gap-2 text-sm text-[var(--muted)]">
          Fichier PDF, PNG ou JPEG (4 Mo max)
          <input
            className="max-w-full text-[var(--ink)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-soft)] file:px-3 file:py-2 file:font-semibold file:text-[var(--ink)]"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => setTicketFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <Button appearance="secondary" type="submit">
          Téléverser le billet
        </Button>
      </Form>
      <Form
        className="my-3 grid grid-cols-2 items-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 max-[420px]:grid-cols-1"
        onSubmit={saveTravelerDetails}
      >
        <h4 className="col-span-full mb-0 text-base font-bold">
          Informations de voyageur et de transport
        </h4>
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={detailsTravelerId}
          onSelectionChange={selectDetailsTraveler}
          isRequired
        >
          <Label className={textFieldStyles().label()}>
            Voyageur à mettre à jour
          </Label>
          <Button appearance="select">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className={listBoxStyles().list()}>
              {travelers.map((person) => (
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
          <Label className={textFieldStyles().label()}>Formule</Label>
          <Button appearance="select">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className={listBoxStyles().list()}>
              <ListBoxItem className={listBoxStyles().item()} id="ski">
                Ski
              </ListBoxItem>
              <ListBoxItem className={listBoxStyles().item()} id="spa">
                Spa
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        {detailsDraft?.activityProfile === "ski" && (
          <Checkbox
            className={checkboxStyles()}
            isSelected={detailsDraft.skiDayThree}
            onChange={(checked) => changeDetails("skiDayThree", checked)}
          >
            Ski le troisième jour
          </Checkbox>
        )}
        <Select
          className="grid min-w-0 gap-2"
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
          <Label className={textFieldStyles().label()}>Transport réservé</Label>
          <Button appearance="select">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className={listBoxStyles().list()}>
              <ListBoxItem className={listBoxStyles().item()} id="train">
                Train
              </ListBoxItem>
              <ListBoxItem className={listBoxStyles().item()} id="flight">
                Avion
              </ListBoxItem>
              <ListBoxItem className={listBoxStyles().item()} id="none">
                Aucun
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        {detailsDraft && detailsDraft.transportMode !== "none" && (
          <>
            <TextField
              className="grid min-w-0 gap-2"
              value={detailsDraft.departureCity ?? ""}
              onChange={(value) =>
                changeDetails("departureCity", value || null)
              }
              isDisabled={!detailsDraft}
            >
              <Label className={textFieldStyles().label()}>
                Ville de départ
              </Label>
              <Input className={textFieldStyles().input()} />
            </TextField>
            <div className="col-span-full grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 max-[420px]:grid-cols-1">
              <h5 className="col-span-full m-0 text-lg font-semibold text-[var(--forest)]">
                Aller
              </h5>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.outboundDateTime ?? ""}
                onChange={(value) =>
                  changeDetails("outboundDateTime", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>
                  Date et heure
                </Label>
                <Input
                  className={textFieldStyles().input()}
                  type="datetime-local"
                />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.outboundTimezone ?? ""}
                onChange={(value) =>
                  changeDetails("outboundTimezone", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>
                  Fuseau horaire
                </Label>
                <Input
                  className={textFieldStyles().input()}
                  placeholder="Europe/Paris"
                />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.outboundMeetingTime ?? ""}
                onChange={(value) =>
                  changeDetails("outboundMeetingTime", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>
                  Heure de rendez-vous
                </Label>
                <Input className={textFieldStyles().input()} type="time" />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.outboundDepartureTime ?? ""}
                onChange={(value) =>
                  changeDetails("outboundDepartureTime", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>
                  Heure de départ
                </Label>
                <Input className={textFieldStyles().input()} type="time" />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.outboundLocation ?? ""}
                onChange={(value) =>
                  changeDetails("outboundLocation", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>Lieu / gare</Label>
                <Input className={textFieldStyles().input()} />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.outboundReference ?? ""}
                onChange={(value) =>
                  changeDetails("outboundReference", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>Référence</Label>
                <Input className={textFieldStyles().input()} />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.outboundSeat ?? ""}
                onChange={(value) =>
                  changeDetails("outboundSeat", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>Place</Label>
                <Input className={textFieldStyles().input()} />
              </TextField>
            </div>
            <div className="col-span-full grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 max-[420px]:grid-cols-1">
              <h5 className="col-span-full m-0 text-lg font-semibold text-[var(--forest)]">
                Retour
              </h5>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.returnDateTime ?? ""}
                onChange={(value) =>
                  changeDetails("returnDateTime", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>
                  Date et heure
                </Label>
                <Input
                  className={textFieldStyles().input()}
                  type="datetime-local"
                />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.returnTimezone ?? ""}
                onChange={(value) =>
                  changeDetails("returnTimezone", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>
                  Fuseau horaire
                </Label>
                <Input
                  className={textFieldStyles().input()}
                  placeholder="Europe/Paris"
                />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.returnMeetingTime ?? ""}
                onChange={(value) =>
                  changeDetails("returnMeetingTime", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>
                  Heure de rendez-vous
                </Label>
                <Input className={textFieldStyles().input()} type="time" />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.returnDepartureTime ?? ""}
                onChange={(value) =>
                  changeDetails("returnDepartureTime", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>
                  Heure de départ
                </Label>
                <Input className={textFieldStyles().input()} type="time" />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.returnLocation ?? ""}
                onChange={(value) =>
                  changeDetails("returnLocation", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>Lieu / gare</Label>
                <Input className={textFieldStyles().input()} />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.returnReference ?? ""}
                onChange={(value) =>
                  changeDetails("returnReference", value || null)
                }
              >
                <Label className={textFieldStyles().label()}>Référence</Label>
                <Input className={textFieldStyles().input()} />
              </TextField>
              <TextField
                className="grid min-w-0 gap-2"
                value={detailsDraft.returnSeat ?? ""}
                onChange={(value) => changeDetails("returnSeat", value || null)}
              >
                <Label className={textFieldStyles().label()}>Place</Label>
                <Input className={textFieldStyles().input()} />
              </TextField>
            </div>
          </>
        )}
        <Button
          appearance="secondary"
          type="submit"
          isDisabled={!detailsTravelerId || !detailsDraft}
        >
          Enregistrer les informations
        </Button>
      </Form>
      {isManager && (
        <>
          <ParticipantAccess tripId={tripId} />
          <Form
            className="my-3 grid grid-cols-2 items-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 max-[420px]:grid-cols-1"
            onSubmit={saveTripName}
          >
            <h4 className="col-span-full mb-0 text-base font-bold">
              Informations du voyage
            </h4>
            <TextField
              className="grid min-w-0 gap-2"
              value={editableTripName}
              onChange={setEditableTripName}
              isRequired
            >
              <Label className={textFieldStyles().label()}>Nom du voyage</Label>
              <Input className={textFieldStyles().input()} maxLength={120} />
            </TextField>
            <Button appearance="secondary" type="submit">
              Enregistrer
            </Button>
          </Form>
          <Form
            className="my-3 grid grid-cols-2 items-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 max-[420px]:grid-cols-1"
            onSubmit={appointCompanion}
          >
            <h4 className="col-span-full mb-0 text-base font-bold">
              Nommer un accompagnateur
            </h4>
            <TextField
              className="grid min-w-0 gap-2"
              value={companionFirstName}
              onChange={setCompanionFirstName}
              isRequired
            >
              <Label className={textFieldStyles().label()}>Prénom</Label>
              <Input
                className={textFieldStyles().input()}
                autoComplete="given-name"
              />
            </TextField>
            <TextField
              className="grid min-w-0 gap-2"
              value={companionLastName}
              onChange={setCompanionLastName}
              isRequired
            >
              <Label className={textFieldStyles().label()}>Nom</Label>
              <Input
                className={textFieldStyles().input()}
                autoComplete="family-name"
              />
            </TextField>
            <TextField
              className="grid min-w-0 gap-2"
              type="email"
              value={companionEmail}
              onChange={setCompanionEmail}
              isRequired
            >
              <Label className={textFieldStyles().label()}>
                Adresse e-mail
              </Label>
              <Input
                className={textFieldStyles().input()}
                autoComplete="email"
              />
            </TextField>
            <Button appearance="secondary" type="submit">
              Ajouter l’accompagnateur
            </Button>
          </Form>
          <Form
            className="my-3 grid grid-cols-2 items-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 max-[420px]:grid-cols-1"
            onSubmit={importParticipants}
          >
            <h4 className="col-span-full mb-0 text-base font-bold">
              Importer les participants
            </h4>
            <p className="col-span-full m-0 text-sm leading-relaxed text-[var(--muted)]">
              Import `.xlsx` jusqu’à 500 lignes. Une erreur bloque toute
              l’importation; une réimportation conserve les billets et chambres
              déjà gérés.
            </p>
            <a
              className={buttonStyles({ appearance: "secondary" })}
              href={`/api/trips/${encodeURIComponent(tripId)}/participants/template`}
            >
              Télécharger le modèle Excel
            </a>
            <label className="col-span-full grid gap-2 text-sm text-[var(--muted)]">
              Classeur participants .xlsx
              <input
                className="max-w-full text-[var(--ink)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-soft)] file:px-3 file:py-2 file:font-semibold file:text-[var(--ink)]"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) =>
                  setImportFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <Button appearance="secondary" type="submit">
              Valider et importer
            </Button>
          </Form>
          <a
            className={buttonStyles({ appearance: "secondary" })}
            href={`/api/trips/${encodeURIComponent(tripId)}/rooms/export`}
          >
            Exporter le rooming Excel
          </a>
        </>
      )}
      {message && (
        <p
          className={`${messageStyles()} whitespace-pre-line`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </section>
  );
}
