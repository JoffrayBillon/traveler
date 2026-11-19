import { ApiError } from "@traveler/api/client";
import { useDeleteParticipantMutation } from "@traveler/api/participants/mutations";
import {
  Button,
  messageStyles,
  textFieldStyles,
} from "@traveler/components/ui";
import { modalFormStyles } from "@traveler/components/ui/modal-form.styles";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Text,
  TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";

export function DeleteParticipantDialog({
  tripId,
  userId,
  email,
  name,
  isDisabled,
  onDeleted,
}: {
  tripId: string;
  userId: string;
  email: string;
  name: string;
  isDisabled: boolean;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const deletion = useDeleteParticipantMutation(tripId);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const canDelete =
    confirmation.trim().toLowerCase() === email.trim().toLowerCase();
  const modal = modalFormStyles();
  const field = textFieldStyles();

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (deletion.isPending) return;
        setConfirmation("");
        deletion.reset();
        setIsOpen(open);
      }}
    >
      <Button appearance="quietDanger" isDisabled={isDisabled}>
        <Trash2 aria-hidden="true" size={16} />
        {t("deleteParticipant")}
      </Button>
      <ModalOverlay
        className={modal.overlay({ class: "z-[60]" })}
        isKeyboardDismissDisabled={deletion.isPending}
      >
        <Modal className={modal.modal({ class: "max-w-md" })}>
          <Dialog
            role="alertdialog"
            aria-describedby="participant-deletion-description"
            className={modal.dialog({ class: "h-auto max-sm:h-auto" })}
          >
            <div className="grid gap-4 overflow-y-auto p-5 sm:p-6">
              <Heading slot="title" className="text-xl font-bold">
                {t("deleteParticipant")}
              </Heading>
              <p
                id="participant-deletion-description"
                className={modal.description()}
              >
                {t("deleteParticipantDescription", { name })}
              </p>
              <TextField
                value={confirmation}
                onChange={setConfirmation}
                isDisabled={deletion.isPending}
                className="grid gap-2"
              >
                <Label className={field.label()}>
                  {t("confirmParticipantEmail")}
                </Label>
                <Text
                  slot="description"
                  className="break-all text-sm text-content-muted"
                >
                  {email}
                </Text>
                <Input
                  className={field.input()}
                  autoComplete="off"
                  inputMode="email"
                  maxLength={320}
                />
              </TextField>
              {deletion.isError && (
                <p role="alert" className={messageStyles({ tone: "danger" })}>
                  {deletion.error instanceof ApiError &&
                  deletion.error.code === "participant_confirmation_mismatch"
                    ? t("participantDeletionEmailChanged")
                    : t("participantDeletionFailed")}
                </p>
              )}
              <div className={modal.actions()}>
                <Button slot="close" isDisabled={deletion.isPending} autoFocus>
                  {t("cancel")}
                </Button>
                <Button
                  appearance="quietDanger"
                  isPending={deletion.isPending}
                  isDisabled={!canDelete}
                  onPress={() =>
                    deletion.mutate(
                      { userId, email: confirmation },
                      {
                        onSuccess: () => {
                          setIsOpen(false);
                          onDeleted();
                        },
                      },
                    )
                  }
                >
                  {t("deleteParticipantPermanently")}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
