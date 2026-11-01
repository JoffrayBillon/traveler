import { ApiError } from "@traveler/api/client";
import { useCreateParticipantMutation } from "@traveler/api/participants/mutations";
import {
  Button,
  messageStyles,
  textFieldStyles,
} from "@traveler/components/ui";
import { type FormEvent, useState } from "react";
import {
  Dialog,
  Form,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";

export function AddParticipantDialog({
  tripId,
  onCreated,
}: {
  tripId: string;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const createParticipantMutation = useCreateParticipantMutation(tripId);
  const [isOpen, setIsOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function createParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      await createParticipantMutation.mutateAsync({
        firstName,
        lastName,
        email,
      });
      onCreated();
      setIsOpen(false);
      setFirstName("");
      setLastName("");
      setEmail("");
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 409
          ? error.code === "participant_already_exists"
            ? t("thisUserIsAlreadyInTheTrip")
            : t("thisEmailAddressIsAlreadyLinkedToAnotherAccount")
          : t("participantCreationFailed"),
      );
    }
  }

  return (
    <>
      <Button
        appearance="primary"
        onPress={() => {
          setMessage("");
          setIsOpen(true);
        }}
      >
        {t("addUserManually")}
      </Button>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        isDismissable
        className="fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm data-[entering]:animate-[fade-in_140ms_ease-out] data-[exiting]:animate-[fade-out_120ms_ease-in] max-sm:items-end max-sm:p-0"
      >
        <Modal className="my-auto w-full max-w-xl outline-none data-[entering]:animate-[modal-enter_220ms_ease-out] data-[exiting]:animate-[modal-exit_150ms_ease-in]">
          <Dialog className="mx-auto flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-feature border border-border bg-surface text-content shadow-panel outline-none max-sm:rounded-b-none max-sm:rounded-t-feature">
            <header className="grid gap-2 border-b border-border px-5 py-4 sm:px-7">
              <Heading slot="title" className="text-xl font-bold">
                {t("addUserManually")}
              </Heading>
              <p className="text-sm leading-relaxed text-content-muted">
                {t("manualParticipantDescription")}
              </p>
            </header>
            <Form
              className="grid gap-5 overflow-y-auto px-5 py-5 sm:px-7"
              onSubmit={createParticipant}
            >
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
              </div>
              <TextField
                className="grid min-w-0 gap-2"
                type="email"
                value={email}
                onChange={setEmail}
                isRequired
              >
                <Label className={textFieldStyles().label()}>
                  {t("emailAddress")}
                </Label>
                <Input
                  className={textFieldStyles().input()}
                  autoComplete="email"
                  maxLength={320}
                />
              </TextField>
              {message && (
                <p className={messageStyles()} role="alert">
                  {message}
                </p>
              )}
              <footer className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  appearance="quietNeutral"
                  type="button"
                  onPress={() => setIsOpen(false)}
                  isDisabled={createParticipantMutation.isPending}
                >
                  {t("cancel")}
                </Button>
                <Button
                  appearance="primary"
                  type="submit"
                  isDisabled={createParticipantMutation.isPending}
                >
                  {createParticipantMutation.isPending
                    ? t("saving")
                    : t("addUser")}
                </Button>
              </footer>
            </Form>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
