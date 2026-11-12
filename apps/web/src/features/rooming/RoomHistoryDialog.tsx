import type { RoomHistoryEntry } from "@traveler/api/rooming/rooming.types";
import { Button, Card } from "@traveler/components/ui";
import { X } from "lucide-react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { useTranslation } from "react-i18next";

const actionLabels = {
  traveler_request: "roomChangeRequestedBy",
  organizer_move: "roomChangeMadeByOrganizer",
  plan_generation: "roomPlanGeneratedBy",
  plan_reset: "roomPlanResetBy",
  roster_import: "roomRosterImportBy",
} as const;

export function RoomHistoryDialog({
  isOpen,
  onOpenChange,
  history,
  isLoading,
  isError,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  history: RoomHistoryEntry[];
  isLoading: boolean;
  isError: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm data-[entering]:animate-[fade-in_140ms_ease-out] data-[exiting]:animate-[fade-out_120ms_ease-in] max-sm:items-end max-sm:p-0"
    >
      <Modal className="w-full max-w-2xl outline-none data-[entering]:animate-[modal-enter_220ms_ease-out] data-[exiting]:animate-[modal-exit_150ms_ease-in]">
        <Dialog className="mx-auto flex max-h-[min(82dvh,56rem)] flex-col overflow-hidden rounded-feature border border-border bg-surface text-content shadow-panel outline-none max-sm:max-h-[88dvh] max-sm:rounded-b-none max-sm:rounded-t-feature">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
            <Heading slot="title" className="text-lg font-bold">
              {t("roomHistoryTitle")}
            </Heading>
            <Button appearance="quiet" slot="close" aria-label={t("close")}>
              <X aria-hidden="true" size={18} />
            </Button>
          </header>
          <div className="grid min-h-0 flex-1 auto-rows-max content-start gap-3 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
            {isLoading ? (
              <p role="status" className="text-sm text-content-muted">
                {t("loadingRoomHistory")}
              </p>
            ) : isError ? (
              <p role="alert" className="text-sm text-content-muted">
                {t("roomHistoryCouldNotLoad")}
              </p>
            ) : history.length === 0 ? (
              <p className="text-sm text-content-muted">{t("noRoomHistory")}</p>
            ) : (
              history.map((entry) => (
                <Card
                  key={entry.id}
                  as="article"
                  spacing="compact"
                  arrangement="stack"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <strong className="text-sm">
                      {t(actionLabels[entry.actionType], {
                        name: entry.actorName,
                      })}
                    </strong>
                    <time
                      className="text-xs text-content-subtle"
                      dateTime={entry.createdAt}
                    >
                      {new Date(entry.createdAt).toLocaleString()}
                    </time>
                  </div>
                  {entry.changes.length > 0 && (
                    <ul className="grid gap-1 text-sm text-content-muted">
                      {entry.changes.map((change) => (
                        <li key={`${entry.id}:${change.userId}`}>
                          {change.personName}:{" "}
                          {change.fromRoom ?? t("unassigned")} →{" "}
                          {change.toRoom ?? t("unassigned")}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))
            )}
          </div>
          <footer className="flex shrink-0 justify-end border-t border-border px-5 py-4 sm:px-7">
            <Button appearance="secondary" slot="close">
              {t("close")}
            </Button>
          </footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
