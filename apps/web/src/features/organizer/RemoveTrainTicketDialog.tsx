import { useRemoveTrainTicketMutation } from "@traveler/api/tickets/train-tickets";
import { Button, messageStyles } from "@traveler/components/ui";
import { modalFormStyles } from "@traveler/components/ui/modal-form.styles";
import { Trash2 } from "lucide-react";
import { useId, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { useTranslation } from "react-i18next";

export function RemoveTrainTicketDialog({
  tripId,
  segmentId,
  document,
}: {
  tripId: string;
  segmentId: string;
  document: { id: string; originalName: string };
}) {
  const { t } = useTranslation();
  const remove = useRemoveTrainTicketMutation(tripId, segmentId);
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const modal = modalFormStyles();

  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(value) => {
        if (!remove.isPending) {
          remove.reset();
          setOpen(value);
        }
      }}
    >
      <Button
        appearance="quiet"
        aria-label={t("trainTicketRemoveNamed", {
          name: document.originalName,
        })}
      >
        <Trash2 aria-hidden="true" size={16} />
      </Button>
      <ModalOverlay
        className={modal.overlay()}
        isKeyboardDismissDisabled={remove.isPending}
      >
        <Modal className={modal.modal({ class: "max-w-md" })}>
          <Dialog
            role="alertdialog"
            aria-describedby={descriptionId}
            className={modal.dialog({ class: "h-auto max-sm:h-auto" })}
          >
            <div className="grid gap-4 p-5">
              <Heading slot="title" className="text-lg font-bold">
                {t("trainTicketRemove")}
              </Heading>
              <p id={descriptionId} className={modal.description()}>
                {t("trainTicketRemoveHint", { name: document.originalName })}
              </p>
              {remove.isError && (
                <p role="alert" className={messageStyles({ tone: "danger" })}>
                  {t("trainTicketRemoveFailed")}
                </p>
              )}
              <div className={modal.actions()}>
                <Button slot="close" autoFocus isDisabled={remove.isPending}>
                  {t("cancel")}
                </Button>
                <Button
                  appearance="quietDanger"
                  isPending={remove.isPending}
                  onPress={() =>
                    remove.mutate(document.id, {
                      onSuccess: () => setOpen(false),
                    })
                  }
                >
                  {t("trainTicketRemove")}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
