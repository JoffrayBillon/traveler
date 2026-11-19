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
import { ParticipantSearchField } from "@traveler/components/ParticipantSearchField";
import { normalizeSearchText } from "@traveler/lib/normalize-search-text";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AddParticipantDialog } from "./AddParticipantDialog";
import { ParticipantEditorDialog } from "./ParticipantEditorDialog";
import {
  defaultParticipantFilters,
  ParticipantFilters,
} from "./ParticipantFilters";
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
  const [filters, setFilters] = useState(defaultParticipantFilters);
  const [selected, setSelected] = useState<StaffTraveler | null>(null);
  const [profile, setProfile] = useState<ProfileDraft | null>(null);
  const [details, setDetails] = useState<DetailsDraft | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffTraveler["role"]>("traveler");
  const [isVip, setIsVip] = useState(false);
  const [message, setMessage] = useState("");
  const [isCopying, setIsCopying] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedUserId) return;
    const timer = window.setTimeout(() => setCopiedUserId(null), 3000);
    return () => window.clearTimeout(timer);
  }, [copiedUserId]);

  const visibleParticipants = useMemo(() => {
    const query = normalizeSearchText(search);
    return participants.filter((person) => {
      const transport = person.groupId
        ? `group:${person.groupId}`
        : person.transportChoice === "none" ||
            (person.transportChoice == null && person.transportMode === "none")
          ? "none"
          : "unconfirmed";
      if (
        (isManager &&
          filters.payment !== "all" &&
          filters.payment !== (person.paymentStatus ?? "unset")) ||
        (filters.role !== "all" && filters.role !== person.role) ||
        (filters.activity !== "all" &&
          filters.activity !== (person.activityProfile ?? "unset")) ||
        (filters.transport !== "all" && filters.transport !== transport)
      )
        return false;
      return (
        !query ||
        normalizeSearchText(
          [
            person.firstName,
            person.lastName,
            person.email,
            person.role,
            person.emergencyContactPhone,
            person.departureCity,
          ]
            .filter(Boolean)
            .join(" "),
        ).includes(query)
      );
    });
  }, [participants, search, filters, isManager]);
  const isFiltered =
    Boolean(normalizeSearchText(search)) ||
    Object.entries(filters).some(
      ([key, value]) => value !== "all" && (key !== "payment" || isManager),
    );

  function openParticipant(person: StaffTraveler) {
    setCopiedUserId(null);
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
      personalPhone: person.personalPhone ?? "",
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
    setIsVip(person.isVip);
    setMessage("");
  }

  async function saveParticipant() {
    if (!selected || !profile || !details) return;
    const profileToSave = { ...profile };
    if (profile.personalPhone === (selected.personalPhone ?? "")) {
      delete profileToSave.personalPhone;
    } else if (profile.personalPhone === null) {
      setMessage(t("enterAValidPhoneNumber"));
      return;
    }
    setMessage("");
    try {
      await saveParticipantMutation.mutateAsync({
        participant: selected,
        profile: profileToSave,
        details,
        email,
        role,
        isVip,
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
    if (!selected || isCopying) return;
    setIsCopying(true);
    setCopiedUserId(null);
    setMessage("");
    try {
      const link = await copyParticipantLinkMutation.mutateAsync(
        selected.userId,
      );
      await navigator.clipboard.writeText(link);
      setCopiedUserId(selected.userId);
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
    } finally {
      setIsCopying(false);
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
      <ParticipantSearchField value={search} onChange={setSearch} />
      <ParticipantFilters
        filters={filters}
        groups={transportGroups}
        isManager={isManager}
        onChange={setFilters}
      />
      <ParticipantList
        participants={visibleParticipants}
        isLoading={participantsQuery.isPending}
        isError={participantsQuery.isError}
        isFiltered={isFiltered}
        isManager={isManager}
        message={message}
        onSelect={openParticipant}
      />
      <ParticipantEditorDialog
        tripId={tripId}
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
        isVip={isVip}
        onIsVipChange={setIsVip}
        isManager={isManager}
        isSaving={saveParticipantMutation.isPending}
        isCopying={isCopying}
        isCopied={selected !== null && copiedUserId === selected.userId}
        setSelected={setSelected}
        setProfile={setProfile}
        setDetails={setDetails}
        onSave={() => void saveParticipant()}
        onCopyLink={() => void copySignInLink()}
        onDeleted={() => {
          setSelected(null);
          setMessage(t("participantDeleted"));
        }}
      />
    </section>
  );
}
