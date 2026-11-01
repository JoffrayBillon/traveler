import type { ProfileDraft } from "@traveler/api/participants/participant-form.types";
import { useTranslation } from "react-i18next";
import { ProfileText } from "./ProfileText";

type ParticipantContactSectionProps = {
  profile: ProfileDraft;
  onChange: <K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) => void;
};

export function ParticipantContactSection({
  profile,
  onChange,
}: ParticipantContactSectionProps) {
  const { t } = useTranslation();
  function changeProfile<K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) {
    onChange(key, value);
  }
  return (
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
        onChange={(value) => changeProfile("dietaryRequirements", value)}
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
          onChange={(value) => changeProfile("emergencyContactLastName", value)}
        />
        <ProfileText
          label={t("emergencyContactPhone")}
          value={profile.emergencyContactPhone ?? ""}
          onChange={(value) => changeProfile("emergencyContactPhone", value)}
        />
      </div>
    </section>
  );
}
