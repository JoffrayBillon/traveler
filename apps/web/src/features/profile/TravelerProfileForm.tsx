import {
  type CountryCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js/max";
import { Pencil, X } from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Dialog,
  Form,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Popover,
  Select,
  SelectValue,
  Text,
  TextArea,
  TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  Button,
  listBoxStyles,
  messageStyles,
  SelectTrigger,
  textFieldStyles,
} from "../../components/ui";
import { formatPhoneInput, PhoneNumberField } from "./PhoneNumberField";

function getInitialPhone(phone: string) {
  const parsed = parsePhoneNumberFromString(phone);
  const country: CountryCode = parsed?.country ?? "FR";
  return {
    country,
    value: parsed
      ? formatPhoneInput(parsed.formatNational(), country)
      : formatPhoneInput(phone, country),
  };
}

export type TravelerProfileValues = {
  firstName: string;
  lastName: string;
  gender: "M" | "F" | null;
  genderConfirmed: boolean;
  dietaryRequirements: string;
  allergens: string;
  emergencyContactFirstName: string;
  emergencyContactLastName: string;
  emergencyContactPhone: string;
  completed: boolean;
};

export function TravelerProfileForm({
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
  onSaved: (values: TravelerProfileValues) => void;
}) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [gender, setGender] = useState<"M" | "F" | null>(initial.gender);
  const [dietaryRequirements, setDietaryRequirements] = useState(
    initial.dietaryRequirements,
  );
  const [allergens, setAllergens] = useState(initial.allergens);
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
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const genderTriggerRef = useRef<HTMLButtonElement>(null);
  const [genderPopoverWidth, setGenderPopoverWidth] = useState(0);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = genderTriggerRef.current;
    if (!trigger) return;
    const updateWidth = () =>
      setGenderPopoverWidth(trigger.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setFirstName(initial.firstName);
    setLastName(initial.lastName);
    setGender(initial.gender);
    setDietaryRequirements(initial.dietaryRequirements);
    setAllergens(initial.allergens);
    setEmergencyContactFirstName(initial.emergencyContactFirstName);
    setEmergencyContactLastName(initial.emergencyContactLastName);
    const initialPhone = getInitialPhone(initial.emergencyContactPhone);
    setPhoneCountry(initialPhone.country);
    setPhoneInput(initialPhone.value);
    setPhoneTouched(false);
    setPhoneSubmitAttempted(false);
    setMessage("");
  }, [
    isOpen,
    initial.firstName,
    initial.lastName,
    initial.gender,
    initial.dietaryRequirements,
    initial.allergens,
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
    if (!parsedPhone?.isValid()) {
      setPhoneTouched(true);
      setPhoneSubmitAttempted(true);
      return;
    }
    const normalizedPhone = parsedPhone.number;
    setIsSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/profile`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            gender,
            dietaryRequirements,
            allergens,
            emergencyContactFirstName,
            emergencyContactLastName,
            emergencyContactPhone: normalizedPhone,
          }),
        },
      );
      if (response.status === 409) {
        setMessage(
          t(
            "sexCannotBeChangedWhileYouAreAssignedToARoomContactTheOrganizersToReviewTheRoomAssignment",
          ),
        );
        return;
      }
      if (!response.ok) throw new Error("profile update failed");
      onSaved({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        genderConfirmed: true,
        dietaryRequirements: dietaryRequirements.trim(),
        allergens: allergens.trim(),
        emergencyContactFirstName: emergencyContactFirstName.trim(),
        emergencyContactLastName: emergencyContactLastName.trim(),
        emergencyContactPhone: normalizedPhone,
        completed: true,
      });
      onOpenChange(false, "saved");
    } catch {
      setMessage(t("yourProfileCouldNotBeSavedPleaseTryAgain"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <section
        className="grid gap-4 rounded-card border border-border bg-surface p-5"
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
            <Button appearance="secondary" onPress={() => onOpenChange(true)}>
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
            <ProfileValue
              label={t("fullName")}
              value={`${initial.firstName} ${initial.lastName}`.trim()}
            />
            <ProfileValue
              label={t("sex")}
              value={
                initial.gender === "M"
                  ? t("man")
                  : initial.gender === "F"
                    ? t("woman")
                    : t("notProvided")
              }
            />
            <ProfileValue
              label={t("dietaryRequirements")}
              value={initial.dietaryRequirements || t("noneDeclared")}
            />
            <ProfileValue
              label={t("allergens")}
              value={initial.allergens || t("noneDeclared")}
            />
            <ProfileValue
              label={t("emergencyContact")}
              value={`${initial.emergencyContactFirstName} ${initial.emergencyContactLastName} · ${initial.emergencyContactPhone}`.trim()}
            />
          </dl>
        )}
      </section>

      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={(nextOpen) =>
          onOpenChange(nextOpen, nextOpen ? undefined : "dismiss")
        }
        isDismissable
        isKeyboardDismissDisabled={false}
        className="fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm data-[entering]:animate-[fade-in_140ms_ease-out] data-[exiting]:animate-[fade-out_120ms_ease-in] max-sm:items-end max-sm:p-0"
      >
        <Modal className="my-auto w-full max-w-5xl outline-none data-[entering]:animate-[modal-enter_220ms_ease-out] data-[exiting]:animate-[modal-exit_150ms_ease-in]">
          <Dialog className="mx-auto flex h-[min(92dvh,66rem)] max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-feature border border-border bg-surface p-0 text-content shadow-panel outline-none max-sm:h-[94dvh] max-sm:max-h-[94dvh] max-sm:rounded-b-none max-sm:rounded-t-feature">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-8 lg:px-10">
              <div className="grid gap-2">
                <Heading
                  slot="title"
                  className="text-xl font-bold tracking-tight sm:text-2xl"
                >
                  {t("completeYourTravelerProfile")}
                </Heading>
                <Text
                  slot="description"
                  className="block max-w-prose text-sm leading-relaxed text-content-muted"
                >
                  {t("profileFormDescription")}
                </Text>
              </div>
              <Button
                appearance="quietNeutral"
                aria-label={
                  isRequired ? t("leaveAndReturnToPreviousPage") : t("close")
                }
                slot="close"
              >
                <X aria-hidden="true" size={18} />
              </Button>
            </header>
            <Form className="flex min-h-0 flex-1 flex-col" onSubmit={save}>
              <div
                data-profile-dialog
                className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6 lg:px-10"
              >
                <fieldset className="grid gap-4 border-0 p-0">
                  <legend className="text-base font-bold">
                    {t("personalInformation")}
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      className="grid min-w-0 gap-2"
                      value={firstName}
                      onChange={setFirstName}
                      isRequired
                    >
                      <Label className={textFieldStyles().label()}>
                        {t("firstName")}
                      </Label>
                      <Input
                        className={textFieldStyles().input()}
                        autoComplete="given-name"
                        maxLength={100}
                      />
                    </TextField>
                    <TextField
                      className="grid min-w-0 gap-2"
                      value={lastName}
                      onChange={setLastName}
                      isRequired
                    >
                      <Label className={textFieldStyles().label()}>
                        {t("lastName")}
                      </Label>
                      <Input
                        className={textFieldStyles().input()}
                        autoComplete="family-name"
                        maxLength={100}
                      />
                    </TextField>
                    <Select
                      className="grid w-full min-w-0 gap-2 sm:col-span-2"
                      selectedKey={gender}
                      onSelectionChange={(key) =>
                        setGender(key === "M" || key === "F" ? key : null)
                      }
                      isRequired
                    >
                      <Label className="flex items-center gap-2 text-sm font-semibold text-content">
                        {t("sex")}
                      </Label>
                      <SelectTrigger
                        ref={genderTriggerRef}
                        className="min-h-11 w-full justify-between"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <Popover
                        className="z-[60] min-w-0 outline-none"
                        style={{ width: genderPopoverWidth }}
                      >
                        <ListBox className={listBoxStyles().list()}>
                          <ListBoxItem
                            className={listBoxStyles().item()}
                            id="M"
                          >
                            {t("man")}
                          </ListBoxItem>
                          <ListBoxItem
                            className={listBoxStyles().item()}
                            id="F"
                          >
                            {t("woman")}
                          </ListBoxItem>
                        </ListBox>
                      </Popover>
                      <Text
                        slot="description"
                        className="text-xs leading-relaxed text-content-muted"
                      >
                        {t("genderFieldDescription")}
                      </Text>
                    </Select>
                  </div>
                </fieldset>

                <fieldset className="grid gap-4 border-0 border-t border-border p-0 pt-5">
                  <legend className="pr-1 text-base font-bold">
                    {t("dietaryNeeds")}
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      className="grid min-w-0 gap-2"
                      value={dietaryRequirements}
                      onChange={setDietaryRequirements}
                    >
                      <Label className={textFieldStyles().label()}>
                        {t("dietaryRequirements")}
                      </Label>
                      <TextArea
                        className={textFieldStyles().input()}
                        rows={3}
                        maxLength={500}
                        placeholder={t("leaveBlankIfNoDietaryRequirements")}
                      />
                    </TextField>
                    <TextField
                      className="grid min-w-0 gap-2"
                      value={allergens}
                      onChange={setAllergens}
                    >
                      <Label className={textFieldStyles().label()}>
                        {t("allergens")}
                      </Label>
                      <TextArea
                        className={textFieldStyles().input()}
                        rows={3}
                        maxLength={500}
                        placeholder={t("leaveBlankIfNoAllergens")}
                      />
                    </TextField>
                  </div>
                </fieldset>

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
                      value={emergencyContactFirstName}
                      onChange={setEmergencyContactFirstName}
                      isRequired
                    >
                      <Label className={textFieldStyles().label()}>
                        {t("firstName")}
                      </Label>
                      <Input
                        className={textFieldStyles().input()}
                        autoComplete="off"
                        maxLength={100}
                      />
                    </TextField>
                    <TextField
                      className="grid min-w-0 gap-2"
                      value={emergencyContactLastName}
                      onChange={setEmergencyContactLastName}
                      isRequired
                    >
                      <Label className={textFieldStyles().label()}>
                        {t("lastName")}
                      </Label>
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
                        onChange={setPhoneInput}
                        onCountryChange={setPhoneCountry}
                        onBlur={() => setPhoneTouched(true)}
                        isInvalid={
                          (phoneTouched || phoneSubmitAttempted) &&
                          !parsePhoneNumberFromString(
                            phoneInput,
                            phoneCountry,
                          )?.isValid()
                        }
                        errorMessage={t("enterAValidPhoneNumber")}
                      />
                    </div>
                  </div>
                </fieldset>
              </div>
              <div className="grid shrink-0 gap-3 border-t border-border bg-surface px-5 py-4 sm:px-8 lg:px-10">
                {message && (
                  <p className={messageStyles({ tone: "danger" })} role="alert">
                    {message}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    appearance="secondary"
                    type="button"
                    slot="close"
                    isDisabled={isSaving}
                  >
                    {isRequired ? t("leaveProfileForNow") : t("cancel")}
                  </Button>
                  <Button
                    appearance="primary"
                    type="submit"
                    isDisabled={isSaving}
                  >
                    {isSaving ? t("saving") : t("saveMyProfile")}
                  </Button>
                </div>
              </div>
            </Form>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-content-subtle">{label}</dt>
      <dd className="break-words font-semibold">{value || "—"}</dd>
    </div>
  );
}
