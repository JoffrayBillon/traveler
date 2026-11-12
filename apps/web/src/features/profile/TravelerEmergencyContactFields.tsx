import { textFieldStyles } from "@traveler/components/ui";
import type { CountryCode } from "libphonenumber-js/max";
import { Input, Label, TextField } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { PhoneNumberField } from "./PhoneNumberField";

export function TravelerEmergencyContactFields({
  firstName,
  lastName,
  phoneInput,
  phoneCountry,
  isPhoneInvalid,
  onFirstNameChange,
  onLastNameChange,
  onPhoneChange,
  onPhoneCountryChange,
  onPhoneBlur,
}: {
  firstName: string;
  lastName: string;
  phoneInput: string;
  phoneCountry: CountryCode;
  isPhoneInvalid: boolean;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPhoneCountryChange: (value: CountryCode) => void;
  onPhoneBlur: () => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="grid gap-4 rounded-card border border-border bg-surface-muted p-4 sm:p-5">
      <legend className="px-1 text-base font-bold">
        {t("emergencyContact")}
      </legend>
      <p className="text-sm leading-relaxed text-content-muted">
        {t("emergencyContactDescription")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          className="grid min-w-0 gap-2"
          value={firstName}
          onChange={onFirstNameChange}
          isRequired
        >
          <Label className={textFieldStyles().label()}>{t("firstName")}</Label>
          <Input
            className={textFieldStyles().input()}
            autoComplete="off"
            maxLength={100}
          />
        </TextField>
        <TextField
          className="grid min-w-0 gap-2"
          value={lastName}
          onChange={onLastNameChange}
          isRequired
        >
          <Label className={textFieldStyles().label()}>{t("lastName")}</Label>
          <Input
            className={textFieldStyles().input()}
            autoComplete="off"
            maxLength={100}
          />
        </TextField>
        <div className="sm:col-span-2">
          <PhoneNumberField
            value={phoneInput}
            country={phoneCountry}
            onChange={onPhoneChange}
            onCountryChange={onPhoneCountryChange}
            onBlur={onPhoneBlur}
            isInvalid={isPhoneInvalid}
            errorMessage={t("enterAValidPhoneNumber")}
          />
        </div>
      </div>
    </fieldset>
  );
}
