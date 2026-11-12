import { Button } from "@traveler/components/ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { useTranslation } from "react-i18next";

export function ImportPreviewDialog({
  isOpen,
  onOpenChange,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm data-[entering]:animate-[fade-in_140ms_ease-out] data-[exiting]:animate-[fade-out_120ms_ease-in] max-sm:items-end max-sm:p-0"
    >
      <Modal className="my-auto w-full max-w-5xl outline-none data-[entering]:animate-[modal-enter_220ms_ease-out] data-[exiting]:animate-[modal-exit_150ms_ease-in]">
        <Dialog className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-feature border border-border bg-surface text-content shadow-panel outline-none max-sm:max-h-[94dvh] max-sm:rounded-b-none max-sm:rounded-t-feature">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
            <Heading slot="title" className="text-lg font-bold">
              {t("importPreview")}
            </Heading>
            <Button appearance="quiet" slot="close" aria-label={t("close")}>
              <X aria-hidden="true" size={18} />
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            {children}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
