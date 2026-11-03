import { ApiError } from "@traveler/api/client";
import {
  useCopyParticipantLinkMutation,
  useSaveParticipantMutation,
} from "@traveler/api/participants/mutations";
import type { StaffTraveler } from "@traveler/api/participants/participant.types";
import type {
  DetailsDraft,
  ProfileDraft,
} from "@traveler/api/participants/participant-form.types";
import { useParticipantDirectoryQuery } from "@traveler/api/participants/queries";
import { useTripTransportQuery } from "@traveler/api/transport/queries";
import { textFieldStyles } from "@traveler/components/ui";
import { getLocale } from "@traveler/i18n";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input, Label, TextField } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { AddParticipantDialog } from "./AddParticipantDialog";
import { ParticipantEditorDialog } from "./ParticipantEditorDialog";
import { ParticipantList } from "./ParticipantList";

export function ParticipantDirectory({
  tripId,
  isManager,
}: {
  tripId: string;
  isManager: boolean;
}) {
  const { t } = useTranslation();
  const saveParticipantMutation = useSaveParticipantMutation(tripId);
  const copyParticipantLinkMutation = useCopyParticipantLinkMutation(tripId);
  const participantsQuery = useParticipantDirectoryQuery(tripId);
  const transportQuery = useTripTransportQuery(tripId);
  const transportGroups = transportQuery.data?.groups ?? [];
  const participants = participantsQuery.data ?? [];
  const transportDrivers = transportQuery.data?.drivers ?? [];
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StaffTraveler | null>(null);
  const [profile, setProfile] = useState<ProfileDraft | null>(null);
  const [details, setDetails] = useState<DetailsDraft | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffTraveler["role"]>("traveler");
  const [message, setMessage] = useState("");

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
      skiDayThree: person.skiDayThree ?? false,
      transportChoice:
        person.transportChoice ?? (person.groupId ? "group" : "unconfirmed"),
      groupId: person.groupId,
      carpoolRole: person.carpoolRole ?? "undecided",
      carpoolDriverUserId: person.carpoolDriverUserId,
    });
    setEmail(person.email);
    setRole(person.role);
    setMessage("");
  }

  async function saveParticipant() {
    if (!selected || !profile || !details) return;
    setMessage("");
    try {
      await saveParticipantMutation.mutateAsync({
        participant: selected,
        profile,
        details,
        email,
        role,
        isManager,
      });
      setSelected(null);
      setMessage(t("participantChangesSaved"));
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      setMessage(
        code === "email_in_use"
          ? t("thisEmailAddressIsAlreadyLinkedToAnotherAccount")
          : code === "last_manager_required" ||
              code === "cannot_change_own_role"
            ? t("roleChangeNotAllowed")
            : code === "invalid_emergency_contact_phone"
              ? t("enterAValidPhoneNumber")
              : t("participantChangesCouldNotBeSaved"),
      );
    }
  }

  async function copySignInLink() {
    if (!selected) return;
    setMessage("");
    try {
      const link = await copyParticipantLinkMutation.mutateAsync(
        selected.userId,
      );
      await navigator.clipboard.writeText(link);
      setMessage(t("signInLinkCopied"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setMessage(
          t("tooManyRequestsTryAgainInSecondsSeconds", {
            seconds: error.retryAfterSeconds ?? 30,
          }),
        );
        return;
      }
      setMessage(t("signInLinkCouldNotBeCopied"));
    }
  }

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
      <ParticipantList
        participants={visibleParticipants}
        isLoading={participantsQuery.isPending}
        isError={participantsQuery.isError}
        search={search}
        isManager={isManager}
        message={message}
        onSelect={openParticipant}
      />
      <ParticipantEditorDialog
        selected={selected}
        profile={profile}
        details={details}
        transportGroups={transportGroups}
        transportDrivers={transportDrivers}
        isTransportLoading={transportQuery.isPending}
        email={email}
        onEmailChange={setEmail}
        role={role}
        onRoleChange={setRole}
        isManager={isManager}
        isSaving={saveParticipantMutation.isPending}
        isCopying={copyParticipantLinkMutation.isPending}
        setSelected={setSelected}
        setProfile={setProfile}
        setDetails={setDetails}
        onSave={() => void saveParticipant()}
        onCopyLink={() => void copySignInLink()}
      />
    </section>
  );
}
