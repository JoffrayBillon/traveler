import { type FormEvent, useEffect, useState } from "react";
import { Checkbox, Form } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  Button,
  buttonStyles,
  checkboxStyles,
  eyebrowStyles,
  messageStyles,
} from "../../components/ui";
import { getLocale } from "../../i18n";
import {
  formatBytes,
  formatJourneyDate,
  roleLabel,
  ticketLabel,
  transportLabel,
} from "../../lib/trip-format";
import type { TripRole } from "../../types/profile";
import {
  TravelerProfileForm,
  type TravelerProfileValues,
} from "../profile/TravelerProfileForm";
import { RoomingPanel } from "../rooming/RoomingPanel";

type TravelerTripData = {
  trip: { id: string; name: string };
  traveler: {
    firstName: string;
    lastName: string;
    gender: "M" | "F" | null;
    genderConfirmed: boolean;
    role: "traveler" | "companion" | "manager";
  };
  profile?: {
    dietaryRequirements: string | null;
    allergens: string | null;
    emergencyContactFirstName: string | null;
    emergencyContactLastName: string | null;
    emergencyContactPhone: string | null;
    completed: boolean;
  };
  details: null | {
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
    updatedAt: string | null;
  };
  tickets: {
    id: string;
    kind: "outbound" | "return" | "other";
    originalName: string;
    size: number;
    createdAt: string;
  }[];
};

export function TripWorkspace({
  tripId,
  role,
  userId,
}: {
  tripId: string;
  role: TripRole;
  userId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<TravelerTripData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setData(null);
    fetch(`/api/trips/${encodeURIComponent(tripId)}/traveler`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("trip information unavailable");
        return (await response.json()) as TravelerTripData;
      })
      .then((nextData) => {
        if (!active) return;
        setData(nextData);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });
    return () => {
      active = false;
    };
  }, [tripId]);

  if (status === "loading")
    return <p role="status">{t("loadingTripInformation")}</p>;
  if (status === "unavailable" || !data)
    return <p role="alert">{t("tripInformationIsCurrentlyUnavailable")}</p>;

  const details = data.details;
  const profile = data.profile ?? {
    dietaryRequirements: null,
    allergens: null,
    emergencyContactFirstName: null,
    emergencyContactLastName: null,
    emergencyContactPhone: null,
    completed: false,
  };
  const isProfileComplete = Boolean(
    profile.completed && data.traveler.genderConfirmed,
  );
  return (
    <div className="grid w-full gap-7">
      <div className="flex items-start justify-between gap-4 max-[420px]:flex-col">
        <div className="grid gap-1">
          <p className={eyebrowStyles()}>{data.trip.name}</p>
          <h2 className="text-2xl font-bold tracking-tight">{t("yourTrip")}</h2>
          <p className="text-sm leading-relaxed text-content-muted">
            {t("informationSharedByYourOrganizers")}
          </p>
        </div>
        <span className="rounded-full bg-surface-muted px-3 py-2 text-xs font-bold text-content">
          {t(roleLabel[role])}
        </span>
      </div>
      <TravelerProfileForm
        tripId={tripId}
        isOpen={!isProfileComplete || isProfileEditorOpen}
        isRequired={!isProfileComplete}
        onOpenChange={(isOpen, reason) => {
          if (isOpen) {
            setIsProfileEditorOpen(true);
            return;
          }
          setIsProfileEditorOpen(false);
          if (!isProfileComplete && reason !== "saved") {
            const historyIndex = window.history.state?.idx;
            if (typeof historyIndex === "number" && historyIndex > 0) {
              navigate(-1);
            } else {
              navigate("/trips", { replace: true });
            }
          }
        }}
        initial={{
          firstName: data.traveler.firstName,
          lastName: data.traveler.lastName,
          gender: data.traveler.gender,
          genderConfirmed: data.traveler.genderConfirmed,
          dietaryRequirements: profile.dietaryRequirements ?? "",
          allergens: profile.allergens ?? "",
          emergencyContactFirstName: profile.emergencyContactFirstName ?? "",
          emergencyContactLastName: profile.emergencyContactLastName ?? "",
          emergencyContactPhone: profile.emergencyContactPhone ?? "",
          completed: profile.completed,
        }}
        onSaved={(values: TravelerProfileValues) => {
          setData((current) =>
            current
              ? {
                  ...current,
                  traveler: {
                    ...current.traveler,
                    firstName: values.firstName,
                    lastName: values.lastName,
                    gender: values.gender,
                    genderConfirmed: values.genderConfirmed,
                  },
                  profile: {
                    dietaryRequirements: values.dietaryRequirements,
                    allergens: values.allergens,
                    emergencyContactFirstName: values.emergencyContactFirstName,
                    emergencyContactLastName: values.emergencyContactLastName,
                    emergencyContactPhone: values.emergencyContactPhone,
                    completed: values.completed,
                  },
                }
              : current,
          );
          setIsProfileEditorOpen(false);
        }}
      />
      <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
        <article className="grid min-w-0 content-start gap-2 rounded-card border border-border bg-surface p-4">
          <span className="text-xs text-content-subtle">{t("activity")}</span>
          <strong className="block break-words text-base">
            {details?.activityProfile === "ski"
              ? t("ski")
              : details?.activityProfile === "spa"
                ? t("spa")
                : t("toBeConfirmed")}
          </strong>
          <p className="text-sm leading-relaxed text-content-muted">
            {details?.skiDayThree
              ? t("text3DaySkiPass")
              : details?.activityProfile === "ski"
                ? t("text2DaySkiPass")
                : ""}
          </p>
        </article>
        <article className="grid min-w-0 content-start gap-2 rounded-card border border-border bg-surface p-4">
          <span className="text-xs text-content-subtle">{t("transport")}</span>
          <strong className="block break-words text-base">
            {t(transportLabel[details?.transportMode ?? ""] ?? "toBeConfirmed")}
          </strong>
          <p className="text-sm leading-relaxed text-content-muted">
            {details?.departureCity ??
              details?.outboundLocation ??
              t("theOrganizersWillAddThisInformation")}
          </p>
        </article>
        <article className="grid min-w-0 content-start gap-2 rounded-card border border-border bg-surface p-4">
          <span className="text-xs text-content-subtle">{t("outbound")}</span>
          <strong className="block break-words text-base">
            {formatJourneyDate(
              details?.outboundDateTime,
              details?.outboundDepartureTime,
              getLocale(),
              t("toBeConfirmed"),
            )}
          </strong>
          <p className="text-sm leading-relaxed text-content-muted">
            {[
              details?.outboundMeetingTime &&
                `${t("meeting")} ${details.outboundMeetingTime}`,
              details?.outboundLocation,
              details?.outboundReference &&
                `${t("ref")} ${details.outboundReference}`,
              details?.outboundSeat && `${t("seat")} ${details.outboundSeat}`,
            ]
              .filter(Boolean)
              .join(" ·") || t("informationToCome")}
          </p>
        </article>
        <article className="grid min-w-0 content-start gap-2 rounded-card border border-border bg-surface p-4">
          <span className="text-xs text-content-subtle">{t("return")}</span>
          <strong className="block break-words text-base">
            {formatJourneyDate(
              details?.returnDateTime,
              details?.returnDepartureTime,
              getLocale(),
              t("toBeConfirmed"),
            )}
          </strong>
          <p className="text-sm leading-relaxed text-content-muted">
            {[
              details?.returnMeetingTime &&
                `${t("meeting")} ${details.returnMeetingTime}`,
              details?.returnLocation,
              details?.returnReference &&
                `${t("ref")} ${details.returnReference}`,
              details?.returnSeat && `${t("seat")} ${details.returnSeat}`,
            ]
              .filter(Boolean)
              .join(" ·") || t("informationToCome")}
          </p>
        </article>
      </div>
      <section className="grid gap-4" aria-labelledby="tickets-title">
        <div className="flex items-start justify-between gap-4 max-[420px]:flex-col">
          <div className="grid gap-1">
            <h3 className="text-lg font-bold" id="tickets-title">
              {t("travelTickets")}
            </h3>
            <p className="text-sm leading-relaxed text-content-muted">
              {t("yourDocumentsAreAvailableOnlyAfterSigningIn")}
            </p>
          </div>
        </div>
        {data.tickets.length === 0 ? (
          <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
            {t("noTicketsHaveBeenAddedYet")}
          </p>
        ) : (
          <ul className="grid list-none gap-2 p-0">
            {data.tickets.map((ticket) => (
              <li
                className="flex items-center justify-between gap-4 rounded-card border border-border p-3 max-[420px]:flex-col max-[420px]:items-start"
                key={ticket.id}
              >
                <span className="grid min-w-0 gap-1">
                  <strong>{t(ticketLabel[ticket.kind])}</strong>
                  <small className="break-words text-content-muted">
                    {ticket.originalName} ·{" "}
                    {formatBytes(ticket.size, getLocale())}
                  </small>
                </span>
                <a
                  className={buttonStyles({
                    appearance: "secondary",
                    class: "shrink-0",
                  })}
                  href={`/api/trips/${encodeURIComponent(tripId)}/tickets/${encodeURIComponent(ticket.id)}`}
                  aria-label={`${t("download")} ${t(ticketLabel[ticket.kind])} : ${ticket.originalName}`}
                >
                  {t("download")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <RoomingPanel tripId={tripId} userId={userId} role={role} />
      {details?.transportMode === "none" && (
        <CarpoolPreferences
          tripId={tripId}
          carpoolPreference={details.carpoolPreference}
          parkingPreference={details.parkingPreference}
          onSaved={(carpoolPreference, parkingPreference) =>
            setData((current) =>
              current?.details
                ? {
                    ...current,
                    details: {
                      ...current.details,
                      carpoolPreference,
                      parkingPreference,
                    },
                  }
                : current,
            )
          }
        />
      )}
    </div>
  );
}

function CarpoolPreferences({
  tripId,
  carpoolPreference,
  parkingPreference,
  onSaved,
}: {
  tripId: string;
  carpoolPreference: boolean | null;
  parkingPreference: boolean | null;
  onSaved: (carpoolPreference: boolean, parkingPreference: boolean) => void;
}) {
  const { t } = useTranslation();
  const [carpool, setCarpool] = useState(carpoolPreference ?? false);
  const [parking, setParking] = useState(parkingPreference ?? false);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCarpool(carpoolPreference ?? false);
    setParking(parkingPreference ?? false);
  }, [carpoolPreference, parkingPreference]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/carpool-preferences`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carpoolPreference: carpool,
            parkingPreference: carpool && parking,
          }),
        },
      );
      if (!response.ok) {
        setMessage(t("yourPreferencesCouldNotBeSaved"));
        return;
      }
      onSaved(carpool, carpool && parking);
      setMessage(t("yourPreferencesHaveBeenSaved"));
    } catch {
      setMessage(t("yourPreferencesCouldNotBeSaved"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      className="grid gap-4 rounded-card border border-border bg-surface p-4"
      aria-labelledby="carpool-title"
    >
      <h3 className="text-lg font-bold" id="carpool-title">
        {t("noTransportBooked")}
      </h3>
      <p className="text-sm leading-relaxed text-content-muted">
        {t("tellUsWhetherYouNeedACarpoolAndIfSoAParkingSpace")}
      </p>
      <Form className="grid justify-items-start gap-3" onSubmit={save}>
        <Checkbox
          className={checkboxStyles()}
          isSelected={carpool}
          isDisabled={isSaving}
          onChange={(selected) => {
            setCarpool(selected);
            if (!selected) setParking(false);
          }}
        >
          <span>{t("iAmTravelingByCarpool")}</span>
        </Checkbox>
        {carpool && (
          <Checkbox
            className={checkboxStyles()}
            isSelected={parking}
            isDisabled={isSaving}
            onChange={setParking}
          >
            <span>{t("iNeedAParkingSpace")}</span>
          </Checkbox>
        )}
        <Button appearance="secondary" type="submit" isDisabled={isSaving}>
          {isSaving ? t("saving") : t("saveMyPreferences")}
        </Button>
      </Form>
      {message && (
        <p className={messageStyles()} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
