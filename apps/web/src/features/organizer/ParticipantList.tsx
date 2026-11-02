import type { StaffTraveler } from "@traveler/api/participants/participant.types";
import { Button, messageStyles } from "@traveler/components/ui";
import { getLocale } from "@traveler/i18n";
import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { roleTranslationKey } from "./participant-formatters";

export function ParticipantList({
  participants,
  isLoading,
  isError,
  search,
  isManager,
  message,
  onSelect,
}: {
  participants: StaffTraveler[];
  isLoading: boolean;
  isError: boolean;
  search: string;
  isManager: boolean;
  message: string;
  onSelect: (participant: StaffTraveler) => void;
}) {
  const { t } = useTranslation();
  if (isLoading) return <p role="status">{t("loadingParticipants")}</p>;
  if (isError)
    return <p role="alert">{t("theParticipantListIsUnavailable")}</p>;
  if (participants.length === 0)
    return (
      <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
        {search
          ? t("noSearchResults")
          : t("noParticipantsHaveBeenImportedForThisTrip")}
      </p>
    );

  const date = (value: string) =>
    new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(
      new Date(value),
    );

  return (
    <>
      <ul className="grid list-none gap-2 p-0">
        {participants.map((person) => (
          <li key={person.userId}>
            <Button
              appearance="secondary"
              className="h-auto w-full justify-between gap-4 p-4 text-left"
              onPress={() => onSelect(person)}
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
                  {t(
                    person.paymentStatus === "partially_paid"
                      ? "partiallyPaid"
                      : person.paymentStatus,
                  )}
                  {person.paymentNeedsReview ? " · !" : ""}
                </span>
              )}
            </Button>
          </li>
        ))}
      </ul>
      {message && (
        <p className={messageStyles()} role="status" aria-live="polite">
          {message}
        </p>
      )}
    </>
  );
}
