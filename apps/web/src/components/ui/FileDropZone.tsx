import { FileText, Upload, X } from "lucide-react";
import type { ComponentProps } from "react";
import {
  Button as AriaButton,
  DropZone,
  FileTrigger,
  isFileDropItem,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

export function FileDropZone({
  file,
  label,
  description,
  acceptedFileTypes,
  extensions,
  onFileChange,
}: {
  file: File | null;
  label: string;
  description: string;
  acceptedFileTypes: string[];
  extensions: string[];
  onFileChange: (file: File | null) => void;
}) {
  const { t } = useTranslation();

  async function acceptDrop(
    event: Parameters<
      NonNullable<ComponentProps<typeof DropZone>["onDrop"]>
    >[0],
  ) {
    const droppedFiles = await Promise.all(
      event.items.filter(isFileDropItem).map((item) => item.getFile()),
    );
    const file = droppedFiles.find(isAcceptedFile);
    onFileChange(file ?? null);
  }

  function isAcceptedFile(file: File) {
    return extensions.some((extension) =>
      file.name.toLocaleLowerCase().endsWith(extension.toLocaleLowerCase()),
    );
  }

  return (
    <DropZone
      aria-label={label}
      onDrop={acceptDrop}
      className="grid min-h-36 content-center justify-items-center gap-3 rounded-card border-2 border-dashed border-border bg-surface-muted/50 px-4 py-5 text-center outline-none transition-colors data-[drop-target]:border-accent data-[drop-target]:bg-accent/10 data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus"
    >
      {file ? (
        <div className="flex w-full max-w-2xl items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 py-2 text-left">
          <span className="flex min-w-0 items-center gap-3">
            <FileText
              aria-hidden="true"
              className="shrink-0 text-accent"
              size={20}
            />
            <span className="grid min-w-0 gap-0.5">
              <strong className="truncate text-sm">{file.name}</strong>
              <span className="text-xs text-content-muted">
                {formatBytes(file.size)}
              </span>
            </span>
          </span>
          <AriaButton
            className="grid size-9 shrink-0 place-items-center rounded-control text-content-muted outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
            aria-label={t("removeSelectedFile")}
            onPress={() => onFileChange(null)}
          >
            <X aria-hidden="true" size={17} />
          </AriaButton>
        </div>
      ) : (
        <>
          <span className="grid size-11 place-items-center rounded-full bg-surface text-accent shadow-sm">
            <Upload aria-hidden="true" size={20} />
          </span>
          <div className="grid gap-1">
            <strong className="text-sm">{label}</strong>
            <span className="text-xs text-content-muted">{description}</span>
          </div>
          <FileTrigger
            acceptedFileTypes={acceptedFileTypes}
            onSelect={(files) => onFileChange(files?.item(0) ?? null)}
          >
            <Button appearance="secondary" type="button">
              {t("chooseFile")}
            </Button>
          </FileTrigger>
        </>
      )}
    </DropZone>
  );
}

function formatBytes(bytes: number) {
  return new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: "byte",
    unitDisplay: "narrow",
    notation: bytes >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(bytes);
}
