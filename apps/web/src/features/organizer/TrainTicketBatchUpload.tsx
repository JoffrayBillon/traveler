import { ApiError } from "@traveler/api/client";
import { useUploadTrainTicketMutation } from "@traveler/api/tickets/train-tickets";
import {
  Button,
  Card,
  FileDropZone,
  messageStyles,
  textFieldStyles,
} from "@traveler/components/ui";
import { type FormEvent, useState } from "react";
import { Form, Label, Text, TextArea, TextField } from "react-aria-components";
import { useTranslation } from "react-i18next";

export function TrainTicketBatchUpload({
  tripId,
  segmentId,
}: {
  tripId: string;
  segmentId: string;
}) {
  const { t } = useTranslation();
  const upload = useUploadTrainTicketMutation(tripId, segmentId);
  const [file, setFile] = useState<File | null>(null);
  const [seats, setSeats] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !seats.trim() || upload.isPending) return;
    upload.mutate(
      { file, seats },
      {
        onSuccess: () => {
          setFile(null);
          setSeats("");
        },
      },
    );
  }

  return (
    <Card as={Form} spacing="compact" arrangement="stack" onSubmit={submit}>
      <FileDropZone
        label={t("trainTicketPdf")}
        description={t("trainTicketPdfHint")}
        acceptedFileTypes={["application/pdf"]}
        extensions={[".pdf"]}
        file={file}
        onFileChange={setFile}
      />
      <TextField
        isRequired
        value={seats}
        onChange={setSeats}
        className="grid gap-2"
      >
        <Label className={textFieldStyles().label()}>
          {t("trainTicketSeats")}
        </Label>
        <TextArea
          className={textFieldStyles().input()}
          rows={4}
          maxLength={40500}
        />
        <Text slot="description" className="text-sm text-content-muted">
          {t("trainTicketSeatsHint")}
        </Text>
      </TextField>
      {upload.isError && (
        <p role="alert" className={messageStyles({ tone: "danger" })}>
          {upload.error instanceof ApiError &&
          upload.error.code === "duplicate_train_seat"
            ? t("trainTicketDuplicateSeat")
            : t("trainTicketUploadFailed")}
        </p>
      )}
      <Button
        type="submit"
        appearance="secondary"
        className="justify-self-start"
        isPending={upload.isPending}
        isDisabled={!file || !seats.trim()}
      >
        {t("trainTicketAddDocument")}
      </Button>
    </Card>
  );
}
