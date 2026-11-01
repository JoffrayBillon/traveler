import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Card } from "../../components/ui";
import type { TravelerProfileValues } from "./TravelerProfileEditorDialog";
import { TravelerProfileValue } from "./TravelerProfileValue";

export function TravelerProfileSummary({
  profile,
  isRequired,
  onEdit,
}: {
  profile: TravelerProfileValues;
  isRequired: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card
      as="section"
      spacing="comfortable"
      arrangement="stack"
      aria-labelledby="traveler-profile-title"
    >
      <div className="flex items-start justify-between gap-4 max-[420px]:flex-col">
        <div className="grid gap-1">
          <h3 className="text-lg font-bold" id="traveler-profile-title">
            {t("yourTravelerProfile")}
          </h3>
          <p className="text-sm leading-relaxed text-content-muted">
            {isRequired
              ? t("completeTheseDetailsToPrepareForYourTrip")
              : t("youCanUpdateThisInformationAtAnyTime")}
          </p>
        </div>
        {!isRequired && (
          <Button appearance="secondary" onPress={onEdit}>
            <Pencil aria-hidden="true" size={16} /> {t("editMyProfile")}
          </Button>
        )}
      </div>
      {isRequired ? (
        <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
          {t("profileDetailsRequiredBeforeContinuing")}
        </p>
      ) : (
        <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">
          <TravelerProfileValue
            label={t("fullName")}
            value={`${profile.firstName} ${profile.lastName}`.trim()}
          />
          <TravelerProfileValue
            label={t("sex")}
            value={
              profile.gender === "M"
                ? t("man")
                : profile.gender === "F"
                  ? t("woman")
                  : t("notProvided")
            }
          />
          <TravelerProfileValue
            label={t("dietaryRequirements")}
            value={profile.dietaryRequirements || t("noneDeclared")}
          />
          <TravelerProfileValue
            label={t("allergens")}
            value={profile.allergens || t("noneDeclared")}
          />
          <TravelerProfileValue
            label={t("emergencyContact")}
            value={`${profile.emergencyContactFirstName} ${profile.emergencyContactLastName} · ${profile.emergencyContactPhone}`.trim()}
          />
        </dl>
      )}
    </Card>
  );
}
