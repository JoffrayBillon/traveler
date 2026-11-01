import { type FormEvent, useState } from "react";
import {
  Form,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "../../components/ui";
import { ApiError } from "../../shared/api/client";
import { useUploadTravelerTicketMutation } from "./ticket-mutations";
import { useParticipantDirectoryQuery } from "./useParticipantDirectoryQuery";

export function TravelerTicketUpload({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const uploadMutation = useUploadTravelerTicketMutation(tripId);
  const travelersQuery = useParticipantDirectoryQuery(tripId);
  const travelers = travelersQuery.data ?? [];
  const [travelerId, setTravelerId] = useState<string | null>(null);
  const [ticketKind, setTicketKind] = useState<string | null>(null);
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  async function uploadTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!travelerId || !ticketKind) {
      setMessage(t("chooseATravelerAndAJourneyBeforeUploading"));
      return;
    }
    if (!ticketFile) {
      setMessage(t("chooseATicketFileToUpload"));
      return;
    }
    if (ticketFile.size > 4 * 1024 * 1024) {
      setMessage(t("theFileExceedsThe4MbLimit"));
      return;
    }
    try {
      await uploadMutation.mutateAsync({
        travelerId,
        kind: ticketKind,
        file: ticketFile,
      });
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 503
          ? t("ticketStorageIsNotConfiguredInThisEnvironment")
          : t("theTicketCouldNotBeUploadedCheckTheFileTypeAndSize"),
      );
      return;
    }
    setTicketFile(null);
    setMessage(t("theTravelTicketHasBeenAdded"));
  }

  return (
    <>
      <Card
        as={Form}
        spacing="compact"
        arrangement="form"
        onSubmit={uploadTicket}
      >
        <h4 className="col-span-full text-base font-bold">
          {t("addATravelTicket")}
        </h4>
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={travelerId}
          onSelectionChange={(key) => setTravelerId(key ? String(key) : null)}
          isRequired
        >
          <Label className={textFieldStyles().label()}>{t("traveler2")}</Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <Popover>
            <ListBox className={listBoxStyles().list()}>
              {travelers.map((person) => (
                <ListBoxItem
                  className={listBoxStyles().item()}
                  key={person.userId}
                  id={person.userId}
                  textValue={`${person.firstName} ${person.lastName}`}
                >
                  {person.firstName} {person.lastName} · {person.email}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={ticketKind}
          onSelectionChange={(key) => setTicketKind(key ? String(key) : null)}
          isRequired
        >
          <Label className={textFieldStyles().label()}>{t("journey")}</Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <Popover>
            <ListBox className={listBoxStyles().list()}>
              <ListBoxItem className={listBoxStyles().item()} id="outbound">
                {t("outbound")}
              </ListBoxItem>
              <ListBoxItem className={listBoxStyles().item()} id="return">
                {t("return")}
              </ListBoxItem>
              <ListBoxItem className={listBoxStyles().item()} id="other">
                {t("otherDocument")}
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        <label className="col-span-full grid gap-2 text-sm text-content-muted">
          {t("pdfPngOrJpegFile4MbMax")}
          <input
            className="max-w-full text-content file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:font-semibold file:text-content"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => setTicketFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <Button
          appearance="secondary"
          type="submit"
          isDisabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? t("saving") : t("uploadTicket")}
        </Button>
      </Card>
      {message && (
        <p
          className="text-sm text-content-muted"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </>
  );
}
