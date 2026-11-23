import { ApiError } from "@traveler/api/client";
import { useRemoveTrainTicketImportDocumentMutation } from "@traveler/api/tickets/train-ticket-imports";
import { Button, messageStyles } from "@traveler/components/ui";
import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { useTranslation } from "react-i18next";

export function RemoveTrainTicketImportDialog({
  tripId,
  segmentId,
  documentId,
  name,
  hasPublished,
  isDisabled,
}: {
  tripId: string;
  segmentId: string;
  documentId: string;
  name: string;
  hasPublished: boolean;
  isDisabled: boolean;
}) {
  const { t } = useTranslation();
  const remove = useRemoveTrainTicketImportDocumentMutation(tripId, segmentId);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (remove.isPending) return;
        remove.reset();
        setIsOpen(open);
      }}
    >
      <Button
        appearance="secondary"
        isDisabled={isDisabled || remove.isPending}
      >
        {t(
          hasPublished
            ? "trainTicketImportWithdraw"
            : "trainTicketImportRemoveDraft",
        )}
      </Button>
      <ModalOverlay
        className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4"
        isDismissable={!remove.isPending}
      >
        <Modal className="w-full max-w-md rounded-feature border border-border bg-surface text-content shadow-panel">
          <Dialog
            role="alertdialog"
            aria-describedby="train-ticket-remove-description"
            className="grid gap-4 p-5 outline-none sm:p-6"
          >
            <Heading slot="title" className="text-lg font-bold">
              {t(
                hasPublished
                  ? "trainTicketImportWithdrawTitle"
                  : "trainTicketImportRemoveTitle",
              )}
            </Heading>
            <p
              id="train-ticket-remove-description"
              className="text-sm text-content-muted"
            >
              {t(
                hasPublished
                  ? "trainTicketImportWithdrawConfirmation"
                  : "trainTicketImportRemoveConfirmation",
                { name },
              )}
            </p>
            {remove.isError && (
              <p role="alert" className={messageStyles({ tone: "danger" })}>
                {remove.error instanceof ApiError &&
                remove.error.code === "train_import_conflict"
                  ? t("trainTicketImportWithdrawalChanged")
                  : t("trainTicketImportRemoveFailed")}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button appearance="secondary" onPress={() => setIsOpen(false)}>
                {t("cancel")}
              </Button>
              <Button
                appearance="quietDanger"
                isPending={remove.isPending}
                onPress={() =>
                  remove.mutate(
                    { documentId, confirmPublished: hasPublished },
                    { onSuccess: () => setIsOpen(false) },
                  )
                }
              >
                {t(
                  hasPublished
                    ? "trainTicketImportWithdraw"
                    : "trainTicketImportRemoveDraft",
                )}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
