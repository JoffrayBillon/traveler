import { ApiError } from "@traveler/api/client";
import {
  usePublishTrainTicketPoolMutation,
  useTrainTicketPoolQuery,
} from "@traveler/api/tickets/train-tickets";
import { Button, Card, messageStyles } from "@traveler/components/ui";
import { useTranslation } from "react-i18next";
import { RemoveTrainTicketDialog } from "./RemoveTrainTicketDialog";
import { TrainTicketBatchUpload } from "./TrainTicketBatchUpload";

export function TrainTicketPoolEditor({
  tripId,
  segmentId,
}: {
  tripId: string;
  segmentId: string;
}) {
  const { t } = useTranslation();
  const query = useTrainTicketPoolQuery(tripId, segmentId);
  const publish = usePublishTrainTicketPoolMutation(tripId, segmentId);

  if (query.isPending) return <p role="status">{t("loadingYourSpace")}</p>;
  if (query.isError)
    return <p role="alert">{t("trainTicketPoolUnavailable")}</p>;
  const pool = query.data;

  return (
    <div className="grid gap-4">
      <TrainTicketBatchUpload tripId={tripId} segmentId={segmentId} />
      {pool.seats.length > 0 && (
        <Card
          as="section"
          spacing="comfortable"
          arrangement="stack"
          aria-labelledby="train-ticket-preview"
        >
          <h5 id="train-ticket-preview" className="font-semibold">
            {t("trainTicketPreview")}
          </h5>
          {pool.unassigned > 0 && (
            <p role="status" className={messageStyles()}>
              {t("trainTicketUnassigned", { value: pool.unassigned })}
            </p>
          )}
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-control border border-border">
            {pool.seats.map((seat) => (
              <li
                key={seat.id}
                className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 text-sm"
              >
                <strong>{seat.label}</strong>
                <span className="text-content-muted">
                  {seat.assignedName ?? t("trainTicketFreeSeat")}
                  {seat.roomNumber &&
                    ` · ${t("trainTicketRoom", { room: seat.roomNumber })}`}
                </span>
                {seat.isNew && (
                  <span className="text-accent">
                    {t("trainTicketProposed")}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {publish.isError && (
            <p role="alert" className={messageStyles({ tone: "danger" })}>
              {publish.error instanceof ApiError &&
              publish.error.code === "train_ticket_pool_changed"
                ? t("trainTicketPreviewChanged")
                : t("trainTicketPublishFailed")}
            </p>
          )}
          <Button
            appearance="primary"
            className="justify-self-start"
            isDisabled={!pool.hasChanges}
            isPending={publish.isPending}
            onPress={() => publish.mutate(pool.snapshot)}
          >
            {t("trainTicketPublish")}
          </Button>
        </Card>
      )}
      {pool.documents.length > 0 && (
        <ul className="divide-y divide-border rounded-card border border-border">
          {pool.documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center justify-between gap-3 px-3 py-1"
            >
              <a
                className="min-w-0 break-words text-sm underline underline-offset-4"
                href={`/api/trips/${encodeURIComponent(tripId)}/tickets/${encodeURIComponent(document.id)}`}
              >
                {document.originalName}
              </a>
              <RemoveTrainTicketDialog
                tripId={tripId}
                segmentId={segmentId}
                document={document}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
