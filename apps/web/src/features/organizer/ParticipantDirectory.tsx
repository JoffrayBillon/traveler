import { parseDateTime, parseTime } from "@internationalized/date";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Search,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarHeading,
  Checkbox,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  I18nProvider,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Popover,
  Select,
  SelectValue,
  TextField,
  TimeField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  Button,
  checkboxStyles,
  messageStyles,
  SelectTrigger,
  textFieldStyles,
} from "../../components/ui";
import { getLocale } from "../../i18n";
import { AddParticipantDialog } from "./AddParticipantDialog";
import type { StaffTraveler } from "./types";

type ProfileDraft = Pick<
  StaffTraveler,
  | "firstName"
  | "lastName"
  | "gender"
  | "dietaryRequirements"
  | "allergens"
  | "emergencyContactFirstName"
  | "emergencyContactLastName"
  | "emergencyContactPhone"
>;

type DetailsDraft = Pick<
  StaffTraveler,
  | "activityProfile"
  | "skiDayThree"
  | "transportMode"
  | "departureCity"
  | "outboundDateTime"
  | "outboundMeetingTime"
  | "outboundDepartureTime"
  | "outboundLocation"
  | "outboundReference"
  | "outboundSeat"
  | "returnDateTime"
  | "returnMeetingTime"
  | "returnDepartureTime"
  | "returnLocation"
  | "returnReference"
  | "returnSeat"
  | "carpoolPreference"
  | "parkingPreference"
>;

export function ParticipantDirectory({
  tripId,
  isManager,
}: {
  tripId: string;
  isManager: boolean;
}) {
  const { t } = useTranslation();
  const [participants, setParticipants] = useState<StaffTraveler[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StaffTraveler | null>(null);
  const [profile, setProfile] = useState<ProfileDraft | null>(null);
  const [details, setDetails] = useState<DetailsDraft | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffTraveler["role"]>("traveler");
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [message, setMessage] = useState("");

  const loadParticipants = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/travelers`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Unable to load travelers");
      const result = (await response.json()) as {
        travelers: StaffTraveler[];
      };
      setParticipants(result.travelers);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [tripId]);

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  const visibleParticipants = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(getLocale());
    if (!query) return participants;
    return participants.filter((person) =>
      [
        person.firstName,
        person.lastName,
        person.email,
        person.role,
        person.emergencyContactPhone,
        person.departureCity,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase(getLocale())
        .includes(query),
    );
  }, [participants, search]);

  function openParticipant(person: StaffTraveler) {
    setSelected(person);
    setProfile({
      firstName: person.firstName,
      lastName: person.lastName,
      gender: person.gender,
      dietaryRequirements: person.dietaryRequirements,
      allergens: person.allergens,
      emergencyContactFirstName: person.emergencyContactFirstName,
      emergencyContactLastName: person.emergencyContactLastName,
      emergencyContactPhone: person.emergencyContactPhone,
    });
    setDetails({
      activityProfile: person.activityProfile,
      skiDayThree: person.skiDayThree,
      transportMode: person.transportMode,
      departureCity: person.departureCity,
      outboundDateTime: person.outboundDateTime,
      outboundMeetingTime: person.outboundMeetingTime,
      outboundDepartureTime: person.outboundDepartureTime,
      outboundLocation: person.outboundLocation,
      outboundReference: person.outboundReference,
      outboundSeat: person.outboundSeat,
      returnDateTime: person.returnDateTime,
      returnMeetingTime: person.returnMeetingTime,
      returnDepartureTime: person.returnDepartureTime,
      returnLocation: person.returnLocation,
      returnReference: person.returnReference,
      returnSeat: person.returnSeat,
      carpoolPreference: person.carpoolPreference,
      parkingPreference: person.parkingPreference,
    });
    setEmail(person.email);
    setRole(person.role);
    setMessage("");
  }

  async function saveParticipant() {
    if (!selected || !profile || !details) return;
    setIsSaving(true);
    setMessage("");
    try {
      const profileResponse = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/participants/${encodeURIComponent(selected.userId)}/profile`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        },
      );
      if (!profileResponse.ok) {
        const result = (await profileResponse.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error ?? "save_failed");
      }
      const hasBookedTransport =
        details.transportMode === "train" || details.transportMode === "flight";
      const savedDetails = hasBookedTransport
        ? { ...details, carpoolPreference: null, parkingPreference: null }
        : {
            ...details,
            departureCity: null,
            outboundDateTime: null,
            outboundMeetingTime: null,
            outboundDepartureTime: null,
            outboundLocation: null,
            outboundReference: null,
            outboundSeat: null,
            returnDateTime: null,
            returnMeetingTime: null,
            returnDepartureTime: null,
            returnLocation: null,
            returnReference: null,
            returnSeat: null,
            carpoolPreference:
              details.transportMode === "none"
                ? details.carpoolPreference
                : null,
            parkingPreference:
              details.transportMode === "none"
                ? details.parkingPreference
                : null,
          };
      const detailsResponse = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(selected.userId)}/details`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...savedDetails,
            outboundTimezone: null,
            returnTimezone: null,
          }),
        },
      );
      if (!detailsResponse.ok) throw new Error("save_failed");
      if (isManager && role !== selected.role) {
        const response = await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/participants/${encodeURIComponent(selected.userId)}/role`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role }),
          },
        );
        if (!response.ok) {
          const result = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(result.error ?? "role_update_failed");
        }
      }
      if (isManager && email.trim().toLowerCase() !== selected.email) {
        const response = await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/participants/${encodeURIComponent(selected.userId)}/email`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          },
        );
        if (!response.ok) {
          const result = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(result.error ?? "email_update_failed");
        }
      }
      await loadParticipants();
      setSelected(null);
      setMessage(t("participantChangesSaved"));
    } catch (error) {
      const code = error instanceof Error ? error.message : "save_failed";
      setMessage(
        code === "gender_change_requires_room_review"
          ? t("genderChangeRequiresRoomReview")
          : code === "email_in_use"
            ? t("thisEmailAddressIsAlreadyLinkedToAnotherAccount")
            : code === "last_manager_required" ||
                code === "cannot_change_own_role"
              ? t("roleChangeNotAllowed")
              : t("participantChangesCouldNotBeSaved"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function copySignInLink() {
    if (!selected) return;
    setIsCopying(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/participants/${encodeURIComponent(selected.userId)}/login-link`,
        { method: "POST" },
      );
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After")) || 30;
        setMessage(
          t("tooManyRequestsTryAgainInSecondsSeconds", {
            seconds: retryAfter,
          }),
        );
        return;
      }
      if (!response.ok) throw new Error("copy_failed");
      const result = (await response.json()) as { link: string };
      await navigator.clipboard.writeText(result.link);
      setMessage(t("signInLinkCopied"));
    } catch {
      setMessage(t("signInLinkCouldNotBeCopied"));
    } finally {
      setIsCopying(false);
    }
  }

  function changeProfile<K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  }

  function changeDetails<K extends keyof DetailsDraft>(
    key: K,
    value: DetailsDraft[K],
  ) {
    setDetails((current) => (current ? { ...current, [key]: value } : current));
  }

  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(
          new Date(value),
        )
      : t("notProvided");

  return (
    <section
      className="grid gap-5"
      aria-labelledby="participant-directory-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-1">
          <h4 className="text-base font-bold" id="participant-directory-title">
            {t("participantsAndUsers")}
          </h4>
          <p className="text-sm leading-relaxed text-content-muted">
            {t("selectAPersonToReviewTheirProfileAndTripDetails")}
          </p>
        </div>
        {isManager && (
          <AddParticipantDialog
            tripId={tripId}
            onCreated={() => {
              void loadParticipants();
              setMessage(t("participantCreated"));
            }}
          />
        )}
      </div>
      <TextField
        className="grid max-w-xl gap-2"
        value={search}
        onChange={setSearch}
      >
        <Label className={textFieldStyles().label()}>
          {t("searchParticipants")}
        </Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle"
            size={17}
          />
          <Input
            className={`${textFieldStyles().input()} pl-10`}
            type="search"
            autoComplete="off"
          />
        </div>
      </TextField>
      {status === "loading" ? (
        <p role="status">{t("loadingParticipants")}</p>
      ) : status === "error" ? (
        <p role="alert">{t("theParticipantListIsUnavailable")}</p>
      ) : visibleParticipants.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
          {search
            ? t("noSearchResults")
            : t("noParticipantsHaveBeenImportedForThisTrip")}
        </p>
      ) : (
        <ul className="grid list-none gap-2 p-0">
          {visibleParticipants.map((person) => (
            <li key={person.userId}>
              <Button
                appearance="secondary"
                className="h-auto w-full justify-between gap-4 p-4 text-left"
                onPress={() => openParticipant(person)}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-content-muted">
                    <UserRound aria-hidden="true" size={19} />
                  </span>
                  <span className="grid min-w-0 gap-1">
                    <strong className="truncate text-content">
                      {person.firstName} {person.lastName}
                    </strong>
                    <span className="truncate text-sm text-content-muted">
                      {person.email}
                    </span>
                    <span className="text-xs text-content-subtle">
                      {t(roleTranslationKey(person.role))} ·{" "}
                      {person.lastLoginAt
                        ? t("lastSignedInDate", {
                            date: date(person.lastLoginAt),
                          })
                        : t("hasNotSignedInYet")}
                    </span>
                  </span>
                </span>
                {isManager && person.paymentStatus && (
                  <span className="shrink-0 rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-content-muted">
                    {t(person.paymentStatus)}
                    {person.paymentNeedsReview ? " · !" : ""}
                  </span>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p className={messageStyles()} role="status" aria-live="polite">
          {message}
        </p>
      )}
      <ModalOverlay
        isOpen={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        isDismissable
        className="fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm data-[entering]:animate-[fade-in_140ms_ease-out] data-[exiting]:animate-[fade-out_120ms_ease-in] max-sm:items-end max-sm:p-0"
      >
        <Modal className="my-auto w-full max-w-5xl outline-none data-[entering]:animate-[modal-enter_220ms_ease-out] data-[exiting]:animate-[modal-exit_150ms_ease-in]">
          <Dialog className="mx-auto flex h-[min(92dvh,66rem)] max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-feature border border-border bg-surface p-0 text-content shadow-panel outline-none max-sm:h-[94dvh] max-sm:max-h-[94dvh] max-sm:rounded-b-none max-sm:rounded-t-feature">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
              <div className="grid min-w-0 gap-1">
                <Heading slot="title" className="truncate text-xl font-bold">
                  {selected
                    ? `${selected.firstName} ${selected.lastName}`
                    : t("participantsAndUsers")}
                </Heading>
                <p className="truncate text-sm text-content-muted">
                  {selected?.email}
                </p>
              </div>
              <Button
                appearance="quietNeutral"
                slot="close"
                aria-label={t("close")}
              >
                {t("close")}
              </Button>
            </header>
            {selected && profile && details && (
              <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8">
                <section
                  className="grid gap-4"
                  aria-labelledby="user-account-title"
                >
                  <h3 className="text-base font-bold" id="user-account-title">
                    {t("accountInformation")}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProfileText
                      label={t("firstName")}
                      value={profile.firstName}
                      onChange={(value) => changeProfile("firstName", value)}
                    />
                    <ProfileText
                      label={t("lastName")}
                      value={profile.lastName}
                      onChange={(value) => changeProfile("lastName", value)}
                    />
                    <TextField
                      className="grid min-w-0 gap-2"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      isDisabled={!isManager}
                    >
                      <Label className={textFieldStyles().label()}>
                        {t("emailAddress")}
                      </Label>
                      <Input
                        className={textFieldStyles().input()}
                        autoComplete="email"
                      />
                    </TextField>
                    <Select
                      className="grid min-w-0 gap-2"
                      selectedKey={role}
                      onSelectionChange={(key) =>
                        key && setRole(String(key) as StaffTraveler["role"])
                      }
                      isDisabled={!isManager}
                    >
                      <Label className={textFieldStyles().label()}>
                        {t("role")}
                      </Label>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <Popover>
                        <ListBox className="grid gap-1 rounded-card border border-border bg-surface p-1.5 shadow-panel">
                          {(["traveler", "companion", "manager"] as const).map(
                            (value) => (
                              <ListBoxItem
                                className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted data-[selected]:bg-surface-muted"
                                id={value}
                                key={value}
                              >
                                {t(roleTranslationKey(value))}
                              </ListBoxItem>
                            ),
                          )}
                        </ListBox>
                      </Popover>
                    </Select>
                    <Select
                      className="grid min-w-0 gap-2"
                      selectedKey={profile.gender ?? "none"}
                      onSelectionChange={(key) =>
                        changeProfile(
                          "gender",
                          key === "M" || key === "F" ? key : null,
                        )
                      }
                    >
                      <Label className={textFieldStyles().label()}>
                        {t("sex")}
                      </Label>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <Popover>
                        <ListBox className="grid gap-1 rounded-card border border-border bg-surface p-1.5 shadow-panel">
                          <ListBoxItem
                            id="none"
                            className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
                          >
                            {t("notProvided")}
                          </ListBoxItem>
                          <ListBoxItem
                            id="M"
                            className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
                          >
                            {t("man")}
                          </ListBoxItem>
                          <ListBoxItem
                            id="F"
                            className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
                          >
                            {t("woman")}
                          </ListBoxItem>
                        </ListBox>
                      </Popover>
                    </Select>
                  </div>
                </section>
                <section
                  className="grid gap-4 border-t border-border pt-5"
                  aria-labelledby="user-contact-title"
                >
                  <h3 className="text-base font-bold" id="user-contact-title">
                    {t("contactAndDietaryDetails")}
                  </h3>
                  <ProfileText
                    label={t("dietaryRequirements")}
                    value={profile.dietaryRequirements ?? ""}
                    onChange={(value) =>
                      changeProfile("dietaryRequirements", value)
                    }
                  />
                  <ProfileText
                    label={t("allergens")}
                    value={profile.allergens ?? ""}
                    onChange={(value) => changeProfile("allergens", value)}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProfileText
                      label={t("emergencyContactFirstName")}
                      value={profile.emergencyContactFirstName ?? ""}
                      onChange={(value) =>
                        changeProfile("emergencyContactFirstName", value)
                      }
                    />
                    <ProfileText
                      label={t("emergencyContactLastName")}
                      value={profile.emergencyContactLastName ?? ""}
                      onChange={(value) =>
                        changeProfile("emergencyContactLastName", value)
                      }
                    />
                    <ProfileText
                      label={t("emergencyContactPhone")}
                      value={profile.emergencyContactPhone ?? ""}
                      onChange={(value) =>
                        changeProfile("emergencyContactPhone", value)
                      }
                    />
                  </div>
                </section>
                <section
                  className="grid gap-4 border-t border-border pt-5"
                  aria-labelledby="user-trip-details-title"
                >
                  <h3
                    className="text-base font-bold"
                    id="user-trip-details-title"
                  >
                    {t("transportAndOptions")}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      className="grid min-w-0 gap-2"
                      selectedKey={details.activityProfile ?? "none"}
                      onSelectionChange={(key) => {
                        const activity =
                          key === "ski" || key === "spa" ? key : null;
                        changeDetails("activityProfile", activity);
                        if (activity !== "ski")
                          changeDetails("skiDayThree", false);
                      }}
                    >
                      <Label className={textFieldStyles().label()}>
                        {t("package")}
                      </Label>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <Popover>
                        <ListBox className="grid gap-1 rounded-card border border-border bg-surface p-1.5 shadow-panel">
                          <ListBoxItem
                            id="none"
                            className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
                          >
                            {t("notProvided")}
                          </ListBoxItem>
                          <ListBoxItem
                            id="ski"
                            className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
                          >
                            {t("ski")}
                          </ListBoxItem>
                          <ListBoxItem
                            id="spa"
                            className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
                          >
                            {t("spa")}
                          </ListBoxItem>
                        </ListBox>
                      </Popover>
                    </Select>
                    <Select
                      className="grid min-w-0 gap-2"
                      selectedKey={details.transportMode ?? "none"}
                      onSelectionChange={(key) =>
                        changeDetails(
                          "transportMode",
                          key === "train" || key === "flight" || key === "none"
                            ? key
                            : null,
                        )
                      }
                    >
                      <Label className={textFieldStyles().label()}>
                        {t("bookedTransport")}
                      </Label>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <Popover>
                        <ListBox className="grid gap-1 rounded-card border border-border bg-surface p-1.5 shadow-panel">
                          <ListBoxItem
                            id="train"
                            className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
                          >
                            {t("train")}
                          </ListBoxItem>
                          <ListBoxItem
                            id="flight"
                            className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
                          >
                            {t("plane")}
                          </ListBoxItem>
                          <ListBoxItem
                            id="none"
                            className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
                          >
                            {t("noTransport")}
                          </ListBoxItem>
                        </ListBox>
                      </Popover>
                    </Select>
                    {details.activityProfile === "ski" && (
                      <Checkbox
                        className={`${checkboxStyles()} col-span-full`}
                        isSelected={details.skiDayThree}
                        onChange={(value) =>
                          changeDetails("skiDayThree", value)
                        }
                      >
                        {t("skiOnDayThree")}
                      </Checkbox>
                    )}
                    {(details.transportMode === "train" ||
                      details.transportMode === "flight") && (
                      <>
                        <ProfileText
                          label={t("departureCity")}
                          value={details.departureCity ?? ""}
                          onChange={(value) =>
                            changeDetails("departureCity", value || null)
                          }
                        />
                        <ProfileDateTime
                          label={t("outboundDateAndTime")}
                          value={details.outboundDateTime ?? ""}
                          onChange={(value) =>
                            changeDetails("outboundDateTime", value || null)
                          }
                        />
                        <ProfileTime
                          label={t("outboundMeetingTime")}
                          value={details.outboundMeetingTime ?? ""}
                          onChange={(value) =>
                            changeDetails("outboundMeetingTime", value || null)
                          }
                        />
                        <ProfileTime
                          label={t("outboundDepartureTime")}
                          value={details.outboundDepartureTime ?? ""}
                          onChange={(value) =>
                            changeDetails(
                              "outboundDepartureTime",
                              value || null,
                            )
                          }
                        />
                        <ProfileText
                          label={t("outboundLocation")}
                          value={details.outboundLocation ?? ""}
                          onChange={(value) =>
                            changeDetails("outboundLocation", value || null)
                          }
                        />
                        <ProfileText
                          label={t("outboundReference")}
                          value={details.outboundReference ?? ""}
                          onChange={(value) =>
                            changeDetails("outboundReference", value || null)
                          }
                        />
                        <ProfileText
                          label={t("outboundSeat")}
                          value={details.outboundSeat ?? ""}
                          onChange={(value) =>
                            changeDetails("outboundSeat", value || null)
                          }
                        />
                        <ProfileDateTime
                          label={t("returnDateAndTime")}
                          value={details.returnDateTime ?? ""}
                          onChange={(value) =>
                            changeDetails("returnDateTime", value || null)
                          }
                        />
                        <ProfileTime
                          label={t("returnMeetingTime")}
                          value={details.returnMeetingTime ?? ""}
                          onChange={(value) =>
                            changeDetails("returnMeetingTime", value || null)
                          }
                        />
                        <ProfileTime
                          label={t("returnDepartureTime")}
                          value={details.returnDepartureTime ?? ""}
                          onChange={(value) =>
                            changeDetails("returnDepartureTime", value || null)
                          }
                        />
                        <ProfileText
                          label={t("returnLocation")}
                          value={details.returnLocation ?? ""}
                          onChange={(value) =>
                            changeDetails("returnLocation", value || null)
                          }
                        />
                        <ProfileText
                          label={t("returnReference")}
                          value={details.returnReference ?? ""}
                          onChange={(value) =>
                            changeDetails("returnReference", value || null)
                          }
                        />
                        <ProfileText
                          label={t("returnSeat")}
                          value={details.returnSeat ?? ""}
                          onChange={(value) =>
                            changeDetails("returnSeat", value || null)
                          }
                        />
                      </>
                    )}
                    {details.transportMode === "none" && (
                      <Checkbox
                        className={checkboxStyles()}
                        isSelected={details.carpoolPreference ?? false}
                        onChange={(value) => {
                          changeDetails("carpoolPreference", value);
                          if (!value) changeDetails("parkingPreference", false);
                        }}
                      >
                        {t("iAmTravelingByCarpool")}
                      </Checkbox>
                    )}
                    {details.transportMode === "none" &&
                      details.carpoolPreference && (
                        <Checkbox
                          className={checkboxStyles()}
                          isSelected={details.parkingPreference ?? false}
                          onChange={(value) =>
                            changeDetails("parkingPreference", value)
                          }
                        >
                          {t("iNeedAParkingSpace")}
                        </Checkbox>
                      )}
                  </div>
                </section>
                {isManager && selected.paymentStatus && (
                  <section className="grid gap-2 border-t border-border pt-5">
                    <h3 className="text-base font-bold">{t("payment")}</h3>
                    <p className="text-sm text-content-muted">
                      {t("paymentStatus", {
                        status: t(selected.paymentStatus),
                      })}{" "}
                      · {t("amountPaid")}:{" "}
                      {formatMoney(selected.amountPaidMinor, getLocale())} ·{" "}
                      {t("amountRemaining", {
                        amount: formatMoney(
                          selected.amountDueMinor,
                          getLocale(),
                        ),
                      })}
                    </p>
                  </section>
                )}
              </div>
            )}
            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-8">
              {isManager ? (
                <Button
                  appearance="secondary"
                  onPress={() => void copySignInLink()}
                  isDisabled={isCopying || isSaving}
                >
                  {isCopying ? (
                    <Check aria-hidden="true" size={16} />
                  ) : (
                    <Copy aria-hidden="true" size={16} />
                  )}
                  {isCopying ? t("copied") : t("copySignInLink")}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  appearance="quietNeutral"
                  slot="close"
                  isDisabled={isSaving}
                >
                  {t("cancel")}
                </Button>
                <Button
                  appearance="primary"
                  onPress={() => void saveParticipant()}
                  isDisabled={isSaving || !profile || !details}
                >
                  {isSaving ? t("saving") : t("saveChanges")}
                </Button>
              </div>
            </footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </section>
  );
}

function ProfileText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField className="grid min-w-0 gap-2" value={value} onChange={onChange}>
      <Label className={textFieldStyles().label()}>{label}</Label>
      <Input className={textFieldStyles().input()} />
    </TextField>
  );
}

function ProfileDateTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const parsedValue = parseDateTimeSafely(value);
  return (
    <I18nProvider locale={getLocale()}>
      <DatePicker
        className="grid min-w-0 gap-2"
        granularity="minute"
        value={parsedValue}
        onChange={(dateTime) => onChange(dateTime?.toString() ?? "")}
      >
        <Label className={textFieldStyles().label()}>{label}</Label>
        <Group className="flex min-h-11 w-full min-w-0 items-center gap-1 rounded-control border border-border bg-surface px-2 text-content outline-none focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
          <DateInput className="flex min-w-0 flex-1 items-center gap-0.5 px-1 py-2">
            {(segment) => (
              <DateSegment
                className="rounded-sm px-0.5 outline-none data-[focused]:bg-surface-muted data-[placeholder]:text-content-muted"
                segment={segment}
              />
            )}
          </DateInput>
          <Button
            appearance="quietNeutral"
            aria-label={t("openDatePicker")}
            className="size-9 min-h-0 shrink-0 rounded-control px-0"
          >
            <CalendarDays aria-hidden="true" size={17} />
          </Button>
        </Group>
        <Popover className="rounded-card border border-border bg-surface p-3 text-content shadow-panel">
          <Dialog className="outline-none">
            <Calendar className="grid gap-3">
              <header className="flex items-center justify-between gap-3">
                <Button
                  slot="previous"
                  appearance="quietNeutral"
                  aria-label={t("previousMonth")}
                  className="size-9 min-h-0 rounded-control px-0"
                >
                  <ChevronLeft aria-hidden="true" size={18} />
                </Button>
                <CalendarHeading className="text-sm font-semibold" />
                <Button
                  slot="next"
                  appearance="quietNeutral"
                  aria-label={t("nextMonth")}
                  className="size-9 min-h-0 rounded-control px-0"
                >
                  <ChevronRight aria-hidden="true" size={18} />
                </Button>
              </header>
              <CalendarGrid className="border-separate border-spacing-1">
                <CalendarGridHeader>
                  {(day) => (
                    <CalendarHeaderCell className="size-9 text-center text-xs font-medium text-content-muted">
                      {day}
                    </CalendarHeaderCell>
                  )}
                </CalendarGridHeader>
                <CalendarGridBody>
                  {(date) => (
                    <CalendarCell
                      className="grid size-9 cursor-pointer place-items-center rounded-control text-sm outline-none transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus data-[outside-month]:text-content-muted/50 data-[selected]:bg-surface-muted data-[selected]:font-semibold data-[selected]:text-content data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40"
                      date={date}
                    />
                  )}
                </CalendarGridBody>
              </CalendarGrid>
            </Calendar>
          </Dialog>
        </Popover>
      </DatePicker>
    </I18nProvider>
  );
}

function ProfileTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const parsedValue = parseTimeSafely(value);
  return (
    <TimeField
      className="grid min-w-0 gap-2"
      value={parsedValue}
      onChange={(time) =>
        onChange(time ? `${padTime(time.hour)}:${padTime(time.minute)}` : "")
      }
    >
      <Label className={textFieldStyles().label()}>{label}</Label>
      <Group className="flex min-h-11 w-full min-w-0 items-center gap-1 rounded-control border border-border bg-surface px-2 text-content outline-none focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
        <DateInput className="flex min-w-0 flex-1 items-center gap-0.5 px-1 py-2">
          {(segment) => (
            <DateSegment
              className="rounded-sm px-0.5 outline-none data-[focused]:bg-surface-muted data-[placeholder]:text-content-muted"
              segment={segment}
            />
          )}
        </DateInput>
        <Select
          aria-label={t("openTimePicker")}
          selectedKey={
            parsedValue
              ? `${padTime(parsedValue.hour)}:${padTime(parsedValue.minute)}`
              : null
          }
          onSelectionChange={(key) => {
            if (key !== null) onChange(String(key));
          }}
        >
          <Button
            slot="trigger"
            appearance="quietNeutral"
            aria-label={t("openTimePicker")}
            className="size-9 min-h-0 shrink-0 rounded-control px-0"
          >
            <Clock3 aria-hidden="true" size={17} />
          </Button>
          <Popover className="max-h-72 w-36 overflow-hidden rounded-card border border-border bg-surface p-1.5 shadow-panel">
            <ListBox
              className="grid max-h-64 gap-1 overflow-y-auto"
              items={getTimeOptions(
                parsedValue
                  ? `${padTime(parsedValue.hour)}:${padTime(parsedValue.minute)}`
                  : "",
              )}
            >
              {(time) => (
                <ListBoxItem
                  className="flex min-h-10 cursor-pointer items-center rounded-control px-3 py-2 text-sm text-content outline-none data-[focused]:bg-surface-muted data-[selected]:bg-surface-muted data-[selected]:font-semibold"
                  id={time}
                  textValue={time}
                >
                  {time}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>
      </Group>
    </TimeField>
  );
}

function parseDateTimeSafely(value: string) {
  if (!value) return null;
  try {
    return parseDateTime(value);
  } catch {
    return null;
  }
}

function parseTimeSafely(value: string) {
  if (!value) return null;
  try {
    return parseTime(value);
  } catch {
    return null;
  }
}

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

function getTimeOptions(selectedTime: string) {
  const options = Array.from({ length: 96 }, (_, index) => {
    const minutes = index * 15;
    return `${padTime(Math.floor(minutes / 60))}:${padTime(minutes % 60)}`;
  });

  if (selectedTime && !options.includes(selectedTime)) {
    options.push(selectedTime);
    options.sort();
  }

  return options;
}

function formatMoney(amountMinor: number | null, locale: string) {
  return amountMinor === null
    ? "—"
    : new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
      }).format(amountMinor / 100);
}

function roleTranslationKey(role: StaffTraveler["role"]) {
  return role === "traveler" ? "traveler2" : role;
}
