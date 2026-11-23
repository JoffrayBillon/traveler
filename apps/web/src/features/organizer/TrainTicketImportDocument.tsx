import type {
  TrainTicketImportItem,
  TrainTicketImportSnapshot,
} from "@traveler/api/tickets/train-ticket-imports";
import { Button, Card } from "@traveler/components/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RemoveTrainTicketImportDialog } from "./RemoveTrainTicketImportDialog";
import { TrainTicketImportItemEditor } from "./TrainTicketImportItemEditor";

export function TrainTicketImportDocument({
  tripId,
  segmentId,
  document,
  travelers,
}: {
  tripId: string;
  segmentId: string;
  document: TrainTicketImportSnapshot["documents"][number];
  travelers: TrainTicketImportSnapshot["travelers"];
}) {
  const { t } = useTranslation();
  const [isExpanded, setExpanded] = useState(document.items.length <= 6);
  const hasPublished = document.items.some(
    (item) => item.status === "published",
  );

  return (
    <Card
      as="section"
      spacing="comfortable"
      arrangement="stack"
      aria-label={t("trainTicketImportDocument", { name: document.name })}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid min-w-0 gap-1">
          <h5 className="break-all font-semibold">{document.name}</h5>
          <p className="text-sm text-content-muted">
            {t("trainTicketImportItemCount", { count: document.items.length })}
          </p>
          <DocumentStatus items={document.items} />
          <a
            className="w-fit rounded-control text-sm text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
            href={`/api/trips/${encodeURIComponent(tripId)}/train-tickets/${encodeURIComponent(segmentId)}/imports/documents/${encodeURIComponent(document.id)}/pdf`}
          >
            {t("trainTicketImportDownloadSource")}
          </a>
        </div>
        <RemoveTrainTicketImportDialog
          tripId={tripId}
          segmentId={segmentId}
          documentId={document.id}
          name={document.name}
          hasPublished={hasPublished}
          isDisabled={false}
        />
      </div>
      {document.items.length > 6 && (
        <Button
          appearance="quiet"
          aria-expanded={isExpanded}
          aria-controls={`train-ticket-import-items-${document.id}`}
          onPress={() => setExpanded((expanded) => !expanded)}
          className="justify-self-start"
        >
          {isExpanded
            ? t("trainTicketImportCollapseItems")
            : t("trainTicketImportExpandItems", {
                count: document.items.length,
              })}
        </Button>
      )}
      {isExpanded &&
        (document.items.length > 0 ? (
          <ul
            id={`train-ticket-import-items-${document.id}`}
            className="grid gap-3"
          >
            {document.items.map((item: TrainTicketImportItem) => (
              <TrainTicketImportItemEditor
                key={item.id}
                tripId={tripId}
                segmentId={segmentId}
                item={item}
                travelers={travelers}
              />
            ))}
          </ul>
        ) : (
          <p role="status" className="text-sm text-content-muted">
            {t("trainTicketImportNoItems")}
          </p>
        ))}
    </Card>
  );
}

function DocumentStatus({ items }: { items: Array<{ status: string }> }) {
  const { t } = useTranslation();
  const key =
    items.length > 0 && items.every((item) => item.status === "published")
      ? "trainTicketImportDocumentPublished"
      : items.some((item) => item.status === "review")
        ? "trainTicketImportDocumentReview"
        : items.some((item) => item.status === "ready")
          ? "trainTicketImportDocumentReady"
          : "trainTicketImportDocumentIgnored";
  return (
    <span role="status" className="text-xs font-medium text-content-muted">
      {t(key)}
    </span>
  );
}
