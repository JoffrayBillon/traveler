import type { ProfileDraft } from "@traveler/api/participants/participant-form.types";
import { PhoneNumberField } from "@traveler/features/profile/PhoneNumberField";
import { getInitialPhone } from "@traveler/features/profile/phone-format";
import type { CountryCode } from "libphonenumber-js/max";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { useRef, useState } from "react";
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
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(
    () => getInitialPhone(profile.personalPhone ?? "").country,
  );
  const [phoneInput, setPhoneInput] = useState(
    () => getInitialPhone(profile.personalPhone ?? "").value,
  );
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneCountryRef = useRef(phoneCountry);
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
      <PhoneNumberField
        label={t("personalPhone")}
        isRequired={false}
        value={phoneInput}
        country={phoneCountry}
        onChange={(value) => {
          setPhoneInput(value);
          const parsed = value
            ? parsePhoneNumberFromString(value, phoneCountryRef.current)
            : undefined;
          onChange(
            "personalPhone",
            value ? (parsed?.isValid() ? parsed.number : null) : "",
          );
        }}
        onCountryChange={(country) => {
          phoneCountryRef.current = country;
          setPhoneCountry(country);
        }}
        onBlur={() => setPhoneTouched(true)}
        isInvalid={
          phoneTouched &&
          Boolean(phoneInput.trim()) &&
          !parsePhoneNumberFromString(phoneInput, phoneCountry)?.isValid()
        }
        errorMessage={t("enterAValidPhoneNumber")}
      />
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
