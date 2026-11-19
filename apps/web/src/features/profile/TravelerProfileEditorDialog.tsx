import { ApiError } from "@traveler/api/client";
import { useSaveTravelerProfileMutation } from "@traveler/api/profile/mutations";
import type { TravelerProfileValues } from "@traveler/api/profile/profile.types";
import { ModalForm } from "@traveler/components/ui";
import {
  type CountryCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js/max";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PhoneNumberField } from "./PhoneNumberField";
import { getInitialPhone } from "./phone-format";
import { TravelerDietaryFields } from "./TravelerDietaryFields";
import { TravelerEmergencyContactFields } from "./TravelerEmergencyContactFields";
import { TravelerIdentityFields } from "./TravelerIdentityFields";

export type { TravelerProfileValues } from "@traveler/api/profile/profile.types";
export function TravelerProfileEditorDialog({
  tripId,
  initial,
  isOpen,
  isRequired,
  onOpenChange,
  onSaved,
}: {
  tripId: string;
  initial: TravelerProfileValues;
  isOpen: boolean;
  isRequired: boolean;
  onOpenChange: (isOpen: boolean, reason?: "dismiss" | "saved") => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const saveProfileMutation = useSaveTravelerProfileMutation(tripId);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [gender, setGender] = useState<"M" | "F" | null>(initial.gender);
  const [dietaryRequirements, setDietaryRequirements] = useState(
    initial.dietaryRequirements,
  );
  const [allergens, setAllergens] = useState(initial.allergens);
  const [personalPhoneCountry, setPersonalPhoneCountry] = useState<CountryCode>(
    () => getInitialPhone(initial.personalPhone ?? "").country,
  );
  const [personalPhoneInput, setPersonalPhoneInput] = useState(
    () => getInitialPhone(initial.personalPhone ?? "").value,
  );
  const [emergencyContactFirstName, setEmergencyContactFirstName] = useState(
    initial.emergencyContactFirstName,
  );
  const [emergencyContactLastName, setEmergencyContactLastName] = useState(
    initial.emergencyContactLastName,
  );
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(
    () => getInitialPhone(initial.emergencyContactPhone).country,
  );
  const [phoneInput, setPhoneInput] = useState(
    () => getInitialPhone(initial.emergencyContactPhone).value,
  );
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phoneSubmitAttempted, setPhoneSubmitAttempted] = useState(false);
  const [personalPhoneTouched, setPersonalPhoneTouched] = useState(false);
  const [personalPhoneSubmitAttempted, setPersonalPhoneSubmitAttempted] =
    useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!isOpen) return;
    setFirstName(initial.firstName);
    setLastName(initial.lastName);
    setGender(initial.gender);
    setDietaryRequirements(initial.dietaryRequirements);
    setAllergens(initial.allergens);
    const initialPersonalPhone = getInitialPhone(initial.personalPhone ?? "");
    setPersonalPhoneCountry(initialPersonalPhone.country);
    setPersonalPhoneInput(initialPersonalPhone.value);
    setEmergencyContactFirstName(initial.emergencyContactFirstName);
    setEmergencyContactLastName(initial.emergencyContactLastName);
    const initialPhone = getInitialPhone(initial.emergencyContactPhone);
    setPhoneCountry(initialPhone.country);
    setPhoneInput(initialPhone.value);
    setPhoneTouched(false);
    setPhoneSubmitAttempted(false);
    setPersonalPhoneTouched(false);
    setPersonalPhoneSubmitAttempted(false);
    setMessage("");
  }, [
    isOpen,
    initial.firstName,
    initial.lastName,
    initial.gender,
    initial.dietaryRequirements,
    initial.allergens,
    initial.personalPhone,
    initial.emergencyContactFirstName,
    initial.emergencyContactLastName,
    initial.emergencyContactPhone,
  ]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gender) {
      setMessage(t("chooseAnOptionForSex"));
      return;
    }
    const parsedPhone = parsePhoneNumberFromString(phoneInput, phoneCountry);
    const initialPersonalPhone = getInitialPhone(initial.personalPhone ?? "");
    const personalPhoneChanged =
      personalPhoneInput !== initialPersonalPhone.value ||
      personalPhoneCountry !== initialPersonalPhone.country;
    const parsedPersonalPhone = personalPhoneInput.trim()
      ? parsePhoneNumberFromString(personalPhoneInput, personalPhoneCountry)
      : undefined;
    if (!parsedPhone?.isValid()) {
      setPhoneTouched(true);
      setPhoneSubmitAttempted(true);
      return;
    }
    if (
      personalPhoneInput.trim() &&
      !parsedPersonalPhone?.isValid() &&
      personalPhoneChanged
    ) {
      setPersonalPhoneTouched(true);
      setPersonalPhoneSubmitAttempted(true);
      return;
    }
    const normalizedPhone = parsedPhone.number;
    setMessage("");
    const savedValues: TravelerProfileValues = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      genderConfirmed: true,
      dietaryRequirements: dietaryRequirements.trim(),
      allergens: allergens.trim(),
      emergencyContactFirstName: emergencyContactFirstName.trim(),
      emergencyContactLastName: emergencyContactLastName.trim(),
      emergencyContactPhone: normalizedPhone,
      ...(personalPhoneChanged
        ? { personalPhone: parsedPersonalPhone?.number ?? "" }
        : {}),
      completed: true,
    };
    try {
      await saveProfileMutation.mutateAsync(savedValues);
      onSaved();
      onOpenChange(false, "saved");
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 409
          ? t("confirmedSexCannotBeChangedContactAnOrganizerIfItIsIncorrect")
          : t("yourProfileCouldNotBeSavedPleaseTryAgain"),
      );
    }
  }

  return (
    <ModalForm
      isOpen={isOpen}
      isSubmitting={saveProfileMutation.isPending}
      title={t("completeYourTravelerProfile")}
      description={t("profileFormDescription")}
      closeLabel={isRequired ? t("leaveAndReturnToPreviousPage") : t("close")}
      cancelLabel={isRequired ? t("leaveProfileForNow") : t("cancel")}
      submitLabel={t("saveMyProfile")}
      submittingLabel={t("saving")}
      message={message}
      onOpenChange={onOpenChange}
      onSubmit={save}
    >
      <TravelerIdentityFields
        firstName={firstName}
        lastName={lastName}
        gender={gender}
        isGenderConfirmed={initial.genderConfirmed}
        onFirstNameChange={setFirstName}
        onLastNameChange={setLastName}
        onGenderChange={setGender}
        isOpen={isOpen}
      />
      <TravelerDietaryFields
        dietaryRequirements={dietaryRequirements}
        allergens={allergens}
        onDietaryRequirementsChange={setDietaryRequirements}
        onAllergensChange={setAllergens}
      />
      <div className="rounded-card border border-border bg-surface-muted p-4 sm:p-5">
        <PhoneNumberField
          value={personalPhoneInput}
          country={personalPhoneCountry}
          onChange={setPersonalPhoneInput}
          onCountryChange={setPersonalPhoneCountry}
          onBlur={() => setPersonalPhoneTouched(true)}
          isInvalid={
            Boolean(personalPhoneInput.trim()) &&
            (personalPhoneTouched || personalPhoneSubmitAttempted) &&
            !parsePhoneNumberFromString(
              personalPhoneInput,
              personalPhoneCountry,
            )?.isValid()
          }
          errorMessage={t("enterAValidPhoneNumber")}
          label={t("personalPhone")}
          isRequired={false}
        />
      </div>
      <TravelerEmergencyContactFields
        firstName={emergencyContactFirstName}
        lastName={emergencyContactLastName}
        phoneInput={phoneInput}
        phoneCountry={phoneCountry}
        isPhoneInvalid={
          (phoneTouched || phoneSubmitAttempted) &&
          !parsePhoneNumberFromString(phoneInput, phoneCountry)?.isValid()
        }
        onFirstNameChange={setEmergencyContactFirstName}
        onLastNameChange={setEmergencyContactLastName}
        onPhoneChange={setPhoneInput}
        onPhoneCountryChange={setPhoneCountry}
        onPhoneBlur={() => setPhoneTouched(true)}
      />
    </ModalForm>
  );
}
