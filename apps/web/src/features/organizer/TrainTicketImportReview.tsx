import { ApiError } from "@traveler/api/client";
import {
  usePublishTrainTicketImportsMutation,
  useTrainTicketImportsQuery,
  useUploadTrainTicketImportMutation,
} from "@traveler/api/tickets/train-ticket-imports";
import { Button, Card, messageStyles } from "@traveler/components/ui";
import type { TFunction } from "i18next";
import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { TrainTicketImportDocument } from "./TrainTicketImportDocument";
import {
  fileKey,
  TrainTicketImportDropZone,
} from "./TrainTicketImportDropZone";

export function TrainTicketImportReview({
  tripId,
  segmentId,
}: {
  tripId: string;
  segmentId: string;
}) {
  const { t } = useTranslation();
  const query = useTrainTicketImportsQuery(tripId, segmentId);
  const upload = useUploadTrainTicketImportMutation(tripId, segmentId);
  const publish = usePublishTrainTicketImportsMutation(tripId, segmentId);
  const [files, setFiles] = useState<File[]>([]);
  const [fileStatuses, setFileStatuses] = useState<
    Record<string, "queued" | "uploading" | "failed">
  >({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [isPublishOpen, setPublishOpen] = useState(false);

  async function uploadFiles() {
    const pending = [...files];
    setProgress({ done: 0, total: pending.length });
    for (const [index, file] of pending.entries()) {
      const key = fileKey(file);
      setFileStatuses((current) => ({ ...current, [key]: "uploading" }));
      setFileErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      try {
        const result = await upload.mutateAsync(file);
        if (result.duplicate) {
          setDuplicateFiles((current) =>
            current.includes(file.name) ? current : [...current, file.name],
          );
        }
        setFileStatuses((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        setFiles((current) =>
          current.filter((candidate) => candidate !== file),
        );
      } catch (error) {
        setFileStatuses((current) => ({ ...current, [key]: "failed" }));
        setFileErrors((current) => ({
          ...current,
          [key]: translateApiError(error, t),
        }));
      }
      setProgress({ done: index + 1, total: pending.length });
    }
    setProgress(null);
  }

  if (query.isPending) return <p role="status">{t("loadingYourSpace")}</p>;
  if (query.isError) {
    return (
      <p role="alert" className={messageStyles({ tone: "danger" })}>
        {t("trainTicketImportUnavailable")}
      </p>
    );
  }

  const snapshot = query.data;
  const publishable = snapshot.documents.some((document) =>
    document.items.some((item) => item.status === "ready"),
  );

  return (
    <div className="grid gap-4">
      <Card
        as="section"
        spacing="comfortable"
        arrangement="stack"
        aria-labelledby="train-ticket-import-heading"
      >
        <div className="grid gap-1">
          <h5 id="train-ticket-import-heading" className="font-semibold">
            {t("trainTicketImportTitle")}
          </h5>
          <p className="text-sm text-content-muted">
            {t("trainTicketImportDescription")}
          </p>
        </div>
        <section
          className="grid gap-2 sm:grid-cols-4"
          aria-label={t("trainTicketImportCoverage")}
        >
          <Coverage
            label={t("trainTicketImportExpected")}
            value={snapshot.coverage.expected}
          />
          <Coverage
            label={t("trainTicketImportPublished")}
            value={snapshot.coverage.published}
          />
          <Coverage
            label={t("trainTicketImportReady")}
            value={snapshot.coverage.ready}
          />
          <Coverage
            label={t("trainTicketImportMissing")}
            value={snapshot.coverage.missing.length}
          />
        </section>
        <TrainTicketImportDropZone
          files={files}
          fileStatuses={fileStatuses}
          isBusy={progress !== null}
          onFilesChange={(next) => {
            setFiles(next);
            const activeKeys = new Set(next.map(fileKey));
            setFileStatuses((current) =>
              Object.fromEntries(
                Object.entries(current).filter(([key]) => activeKeys.has(key)),
              ),
            );
            setFileErrors((current) =>
              Object.fromEntries(
                Object.entries(current).filter(([key]) => activeKeys.has(key)),
              ),
            );
          }}
        />
        {duplicateFiles.length > 0 && (
          <ul className="grid gap-1">
            {duplicateFiles.map((name) => (
              <li key={name} role="status" className={messageStyles()}>
                {t("trainTicketImportDuplicateFile", { name })}
              </li>
            ))}
          </ul>
        )}
        {Object.entries(fileErrors).length > 0 && (
          <ul className="grid gap-1">
            {Object.entries(fileErrors).map(([key, error]) => (
              <li
                key={key}
                role="alert"
                className={messageStyles({ tone: "danger" })}
              >
                {key.split(":")[0]}: {error}
              </li>
            ))}
          </ul>
        )}
        {progress && (
          <p role="status" aria-live="polite" className={messageStyles()}>
            {t("trainTicketImportUploadProgress", progress)}
          </p>
        )}
        <Button
          appearance="secondary"
          className="justify-self-start"
          isDisabled={!files.length || progress !== null}
          isPending={progress !== null}
          onPress={() => void uploadFiles()}
        >
          {Object.keys(fileErrors).length > 0
            ? t("trainTicketImportRetryFailed")
            : t("trainTicketImportUpload")}
        </Button>
      </Card>

      {snapshot.coverage.missing.length > 0 && (
        <Card as="section" spacing="compact" arrangement="stack">
          <h5 className="font-semibold">{t("trainTicketImportMissingList")}</h5>
          <ul className="grid gap-1">
            {snapshot.coverage.missing.map((traveler) => (
              <li key={traveler.id} className="text-sm">
                {traveler.name}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {snapshot.documents.map((document) => (
        <TrainTicketImportDocument
          key={document.id}
          tripId={tripId}
          segmentId={segmentId}
          document={document}
          travelers={snapshot.travelers}
        />
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <DialogTrigger isOpen={isPublishOpen} onOpenChange={setPublishOpen}>
          <Button
            appearance="primary"
            isDisabled={!publishable || publish.isPending || progress !== null}
            isPending={publish.isPending}
          >
            {t("trainTicketImportPublish")}
          </Button>
          <ModalOverlay
            className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4"
            isDismissable={!publish.isPending}
          >
            <Modal className="w-full max-w-lg rounded-feature border border-border bg-surface text-content shadow-panel">
              <Dialog
                role="alertdialog"
                className="grid gap-4 p-5 outline-none sm:p-6"
              >
                <Heading slot="title" className="text-lg font-bold">
                  {t("trainTicketImportPublishTitle")}
                </Heading>
                <p className="text-sm text-content-muted">
                  {t("trainTicketImportPublishConfirmation", {
                    ready: snapshot.coverage.ready,
                    missing: snapshot.coverage.missing.length,
                  })}
                </p>
                {publish.isError && (
                  <p role="alert" className={messageStyles({ tone: "danger" })}>
                    {translateApiError(publish.error, t)}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    appearance="secondary"
                    onPress={() => setPublishOpen(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    appearance="primary"
                    isPending={publish.isPending}
                    onPress={() =>
                      publish.mutate(snapshot.snapshot, {
                        onSuccess: () => setPublishOpen(false),
                      })
                    }
                  >
                    {t("trainTicketImportPublishReady")}
                  </Button>
                </div>
              </Dialog>
            </Modal>
          </ModalOverlay>
        </DialogTrigger>
        {publishable && snapshot.coverage.missing.length > 0 && (
          <span className="text-sm text-content-muted">
            {t("trainTicketImportPartialAllowed")}
          </span>
        )}
      </div>
    </div>
  );
}

function Coverage({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-1 rounded-control border border-border bg-surface-muted/50 px-3 py-2">
      <span className="text-xs text-content-muted">{label}</span>
      <strong className="text-lg tabular-nums">{value}</strong>
    </div>
  );
}

function translateApiError(error: unknown, t: TFunction) {
  if (error instanceof ApiError) {
    const translationKeys = {
      train_import_changed: "trainTicketImportChanged",
      invalid_train_import_pdf: "trainTicketImportInvalidPdf",
      file_size_not_allowed: "trainTicketImportFileTooLarge",
      train_import_conflict: "trainTicketImportConflict",
    } as const;
    const key =
      error.code && error.code in translationKeys
        ? translationKeys[error.code as keyof typeof translationKeys]
        : null;
    if (key) return String(t(key));
  }
  return String(t("trainTicketImportFailed"));
}
