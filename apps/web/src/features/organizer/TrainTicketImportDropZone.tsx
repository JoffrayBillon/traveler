import { Button, messageStyles } from "@traveler/components/ui";
import { FileText, Upload, X } from "lucide-react";
import { useState } from "react";
import {
  Button as AriaButton,
  DropZone,
  FileTrigger,
  isFileDropItem,
} from "react-aria-components";
import { useTranslation } from "react-i18next";

export function TrainTicketImportDropZone({
  files,
  onFilesChange,
  fileStatuses,
  isBusy = false,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  fileStatuses: Record<string, "queued" | "uploading" | "failed">;
  isBusy?: boolean;
}) {
  const { t } = useTranslation();
  const [invalidCount, setInvalidCount] = useState(0);

  function addFiles(incoming: File[]) {
    const valid = incoming.filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf"),
    );
    setInvalidCount(incoming.length - valid.length);
    onFilesChange([...new Set([...files, ...valid])]);
  }

  return (
    <div className="grid gap-3">
      <DropZone
        aria-label={t("trainTicketImportDropLabel")}
        onDrop={async (event) => {
          if (isBusy) return;
          const dropped = await Promise.all(
            event.items.filter(isFileDropItem).map((item) => item.getFile()),
          );
          addFiles(dropped);
        }}
        className="grid min-h-36 content-center justify-items-center gap-3 rounded-card border-2 border-dashed border-border bg-surface-muted/50 px-4 py-5 text-center outline-none transition-colors data-[drop-target]:border-accent data-[drop-target]:bg-accent/10 data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus"
      >
        <span className="grid size-11 place-items-center rounded-full bg-surface text-accent shadow-sm">
          <Upload aria-hidden="true" size={20} />
        </span>
        <span className="grid gap-1">
          <strong className="text-sm">{t("trainTicketImportDropLabel")}</strong>
          <span className="text-xs text-content-muted">
            {t("trainTicketImportDropHint")}
          </span>
        </span>
        <FileTrigger
          acceptedFileTypes={["application/pdf"]}
          allowsMultiple
          onSelect={(list) => addFiles(Array.from(list ?? []))}
        >
          <Button appearance="secondary" type="button" isDisabled={isBusy}>
            {t("chooseFiles")}
          </Button>
        </FileTrigger>
      </DropZone>
      {invalidCount > 0 && (
        <p role="alert" className={messageStyles({ tone: "danger" })}>
          {t("trainTicketImportInvalidPdf")}
        </p>
      )}
      {files.length > 0 && (
        <ul aria-label={t("trainTicketImportQueue")} className="grid gap-2">
          {files.map((file) => (
            <li
              key={fileKey(file)}
              className="flex min-w-0 items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText
                  aria-hidden="true"
                  size={18}
                  className="shrink-0 text-accent"
                />
                <span className="truncate text-sm">{file.name}</span>
                <span className="shrink-0 text-xs text-content-muted">
                  {t(fileStatusKeys[fileStatuses[fileKey(file)] ?? "queued"])}
                </span>
              </span>
              <AriaButton
                className="grid size-9 shrink-0 place-items-center rounded-control text-content-muted outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
                aria-label={t("removeSelectedFile")}
                isDisabled={isBusy}
                onPress={() =>
                  onFilesChange(files.filter((current) => current !== file))
                }
              >
                <X aria-hidden="true" size={17} />
              </AriaButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const fileKeys = new WeakMap<File, string>();
let nextFileKey = 0;

export function fileKey(file: File) {
  const current = fileKeys.get(file);
  if (current) return current;
  const key = String(++nextFileKey);
  fileKeys.set(file, key);
  return key;
}

const fileStatusKeys = {
  queued: "trainTicketImportQueued",
  uploading: "trainTicketImportFileUploading",
  failed: "trainTicketImportFileFailedStatus",
} as const;
