import type {
  TrainTicketImportItem,
  TrainTicketImportSnapshot,
} from "@traveler/api/tickets/train-ticket-imports";
import { useUpdateTrainTicketImportItemMutation } from "@traveler/api/tickets/train-ticket-imports";
import {
  Button,
  Card,
  checkboxStyles,
  listBoxStyles,
  messageStyles,
  SelectTrigger,
  textFieldStyles,
} from "@traveler/components/ui";
import { useState } from "react";
import {
  Checkbox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField,
  Popover,
  Select,
  SelectValue,
  TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";

const kinds = [
  "named",
  "transferable",
  "collective",
  "ignored",
  "detected",
] as const;
const kindTranslationKeys = {
  named: "trainTicketImportKindNamed",
  transferable: "trainTicketImportKindTransferable",
  collective: "trainTicketImportKindCollective",
  ignored: "trainTicketImportKindIgnored",
  detected: "trainTicketImportKindDetected",
} as const;
const carrierTranslationKeys = {
  inoui: "trainTicketCarrierInoui",
  lyria: "trainTicketCarrierLyria",
  ouigo: "trainTicketCarrierOuigo",
  trenitalia: "trainTicketCarrierTrenitalia",
  ter: "trainTicketCarrierTer",
} as const;
const statusTranslationKeys = {
  ready: "trainTicketImportStatusReady",
  review: "trainTicketImportStatusReview",
  published: "trainTicketImportStatusPublished",
  ignored: "trainTicketImportStatusIgnored",
} as const;
const issueTranslationKeys = {
  duplicateTicket: "trainTicketImportIssueDuplicateTicket",
  segmentMismatch: "trainTicketImportIssueSegmentMismatch",
  travelerUnavailable: "trainTicketImportIssueTravelerUnavailable",
  unassigned: "trainTicketImportIssueUnassigned",
  unrecognized: "trainTicketImportIssueUnrecognized",
  multipleTickets: "trainTicketImportIssueMultipleTickets",
  collectiveUnconfirmed: "trainTicketImportIssueCollectiveUnconfirmed",
} as const;

export function TrainTicketImportItemEditor({
  tripId,
  segmentId,
  item,
  travelers,
}: {
  tripId: string;
  segmentId: string;
  item: TrainTicketImportItem;
  travelers: TrainTicketImportSnapshot["travelers"];
}) {
  const { t } = useTranslation();
  const update = useUpdateTrainTicketImportItemMutation(tripId, segmentId);
  const [selectedIds, setSelectedIds] = useState(
    item.kind === "collective" ? item.userIds : [],
  );
  const [editing, setEditing] = useState(false);
  const isPublished = item.status === "published";
  const [capacity, setCapacity] = useState(
    item.capacity ?? Math.max(1, item.userIds.length),
  );
  const kind: (typeof kinds)[number] =
    item.status === "ignored"
      ? "ignored"
      : (kinds.find((candidate) => candidate === item.kind) ?? "detected");
  const issueKey =
    item.issue && item.issue in issueTranslationKeys
      ? issueTranslationKeys[item.issue as keyof typeof issueTranslationKeys]
      : "trainTicketImportNeedsReview";
  const issueText = item.issue
    ? t(issueKey, {
        defaultValue: t("trainTicketImportNeedsReview"),
      })
    : null;
  const identity = [item.firstName, item.lastName].filter(Boolean).join(" ");
  const display =
    [item.ticketNumber, identity || null].filter(Boolean).join(" · ") ||
    t("trainTicketImportUnrecognizedItem");
  const needsAssignment =
    item.status === "review" || kind === "collective" || editing;
  const field = textFieldStyles();
  const updateKind = (next: (typeof kinds)[number]) =>
    update.mutate({
      itemId: item.id,
      kind: next,
      ...(next === "collective"
        ? {
            userIds: selectedIds,
            capacity: Math.max(1, item.capacity ?? selectedIds.length),
          }
        : {}),
    });
  const toggleTraveler = (userId: string, checked: boolean) => {
    const next = checked
      ? [...selectedIds, userId]
      : selectedIds.filter((id) => id !== userId);
    setSelectedIds(next);
  };

  return (
    <Card as="li" spacing="compact" arrangement="stack" className="gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid min-w-0 gap-1">
          <strong className="break-words text-sm">
            {t("trainTicketImportPages", { pages: item.pages.join(", ") })}
          </strong>
          <span className="text-sm text-content-muted">{display}</span>
          {issueText && (
            <p role="status" className={messageStyles()}>
              {issueText}
            </p>
          )}
        </div>
        <a
          className="shrink-0 rounded-control px-2 py-1 text-sm text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
          href={`/api/trips/${encodeURIComponent(tripId)}/train-tickets/${encodeURIComponent(segmentId)}/imports/items/${encodeURIComponent(item.id)}/pdf`}
          target="_blank"
          rel="noreferrer"
        >
          {t("trainTicketImportPreviewPdf")}
        </a>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-content-muted sm:grid-cols-4">
        {item.carrier && (
          <Metadata
            label={t("trainTicketImportCarrier")}
            value={t(carrierTranslationKeys[item.carrier])}
          />
        )}
        {item.reservation && (
          <Metadata
            label={t("trainTicketImportReservation")}
            value={item.reservation}
          />
        )}
        {item.serviceReference && (
          <Metadata
            label={t("trainTicketImportService")}
            value={item.serviceReference}
          />
        )}
        {item.carriage && (
          <Metadata
            label={t("trainTicketImportCarriage")}
            value={item.carriage}
          />
        )}
        {item.seat && (
          <Metadata label={t("trainTicketImportSeat")} value={item.seat} />
        )}
        <Metadata
          label={t("trainTicketImportStatus")}
          value={t(statusTranslationKeys[item.status])}
        />
      </dl>
      <Select
        aria-label={t("trainTicketImportClassification")}
        selectedKey={kind}
        onSelectionChange={(key) =>
          key && updateKind(String(key) as (typeof kinds)[number])
        }
        isDisabled={isPublished || update.isPending}
      >
        <Label className={field.label()}>
          {t("trainTicketImportClassification")}
        </Label>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <Popover>
          <ListBox
            className={listBoxStyles().list()}
            items={kinds.map((id) => ({ id }))}
          >
            {({ id }) => (
              <ListBoxItem id={id} className={listBoxStyles().item()}>
                {t(kindTranslationKeys[id])}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </Select>
      {item.status === "ready" &&
        !editing &&
        (kind === "transferable" || kind === "named") && (
          <Button
            appearance="secondary"
            className="justify-self-start"
            onPress={() => setEditing(true)}
          >
            {t("edit")}
          </Button>
        )}
      {needsAssignment && kind !== "ignored" && (
        <div className="grid gap-3">
          {kind === "named" && (
            <Select
              aria-label={t("trainTicketImportAssignTraveler")}
              selectedKey={item.userIds[0] ?? null}
              onSelectionChange={(key) =>
                key &&
                update.mutate({
                  itemId: item.id,
                  kind: "named",
                  userIds: [String(key)],
                })
              }
              isDisabled={isPublished || update.isPending}
            >
              <Label className={field.label()}>
                {t("trainTicketImportAssignTraveler")}
              </Label>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <Popover>
                <ListBox className={listBoxStyles().list()} items={travelers}>
                  {(traveler) => (
                    <ListBoxItem
                      id={traveler.id}
                      className={listBoxStyles().item()}
                    >
                      {traveler.name}
                    </ListBoxItem>
                  )}
                </ListBox>
              </Popover>
            </Select>
          )}
          {(kind === "transferable" || kind === "named") && (
            <div className="grid gap-3 sm:grid-cols-3">
              <InlineEdit
                label={t("trainTicketImportTicketNumber")}
                value={item.ticketNumber ?? ""}
                isDisabled={isPublished || update.isPending}
                onSave={(value) =>
                  update.mutate({ itemId: item.id, kind, ticketNumber: value })
                }
              />
              <InlineEdit
                label={t("trainTicketImportCarriage")}
                value={item.carriage ?? ""}
                isDisabled={isPublished || update.isPending}
                onSave={(value) =>
                  update.mutate({ itemId: item.id, kind, carriage: value })
                }
              />
              <InlineEdit
                label={t("trainTicketImportSeat")}
                value={item.seat ?? ""}
                isDisabled={isPublished || update.isPending}
                onSave={(value) =>
                  update.mutate({ itemId: item.id, kind, seat: value })
                }
              />
            </div>
          )}
          {kind === "collective" && (
            <fieldset className="grid gap-2 rounded-control border border-border p-3">
              <legend className="px-1 text-sm font-semibold">
                {t("trainTicketImportCollectiveTravelers")}
              </legend>
              {travelers.map((traveler) => (
                <Checkbox
                  key={traveler.id}
                  className={checkboxStyles()}
                  isSelected={selectedIds.includes(traveler.id)}
                  isDisabled={isPublished || update.isPending}
                  onChange={(checked) => toggleTraveler(traveler.id, checked)}
                >
                  <span>{traveler.name}</span>
                </Checkbox>
              ))}
              <NumberField
                minValue={1}
                maxValue={500}
                value={capacity}
                onChange={(next) => setCapacity(next)}
                isDisabled={isPublished || update.isPending}
                className="grid gap-2"
              >
                <Label className={field.label()}>
                  {t("trainTicketImportCollectiveCapacity")}
                </Label>
                <Input className={field.input()} />
              </NumberField>
              {(capacity !==
                (item.capacity ?? Math.max(1, item.userIds.length)) ||
                !sameIds(selectedIds, item.userIds)) && (
                <Button
                  appearance="secondary"
                  className="justify-self-start"
                  isPending={update.isPending}
                  isDisabled={
                    isPublished ||
                    !Number.isInteger(capacity) ||
                    capacity < 1 ||
                    selectedIds.length > capacity
                  }
                  onPress={() =>
                    update.mutate({
                      itemId: item.id,
                      kind: "collective",
                      userIds: selectedIds,
                      capacity: Math.max(1, capacity),
                    })
                  }
                >
                  {t("trainTicketImportSaveCollective")}
                </Button>
              )}
            </fieldset>
          )}
          {kind === "transferable" && (
            <p className="text-sm text-content-muted">
              {t("trainTicketImportTransferableHint")}
            </p>
          )}
        </div>
      )}
      {update.isError && (
        <p role="alert" className={messageStyles()}>
          {t("trainTicketImportUpdateFailed")}
        </p>
      )}
    </Card>
  );
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt>{label}</dt>
      <dd className="truncate font-medium text-content">{value}</dd>
    </div>
  );
}

function InlineEdit({
  label,
  value,
  isDisabled,
  onSave,
}: {
  label: string;
  value: string;
  isDisabled: boolean;
  onSave: (value: string) => void;
}) {
  const field = textFieldStyles();
  return (
    <TextField
      key={`${label}:${value}`}
      defaultValue={value}
      isDisabled={isDisabled}
      className="grid min-w-0 gap-1"
    >
      <Label className={field.label()}>{label}</Label>
      <Input
        className={field.input()}
        onBlur={(event) => {
          const next = event.currentTarget.value.trim();
          if (next !== value) onSave(next);
        }}
      />
    </TextField>
  );
}
