import type { TFunction } from "i18next";
import { motion, useReducedMotion } from "motion/react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  Checkbox,
  Form,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  Button,
  buttonStyles,
  checkboxStyles,
  listBoxStyles,
  messageStyles,
  SelectTrigger,
  textFieldStyles,
} from "../../components/ui";
import { FileDropZone } from "../../components/ui/FileDropZone";
import { getTranslationKeyForFrenchSourceText } from "../../i18n/resources";
import { ParticipantDirectory } from "./ParticipantDirectory";
import type { StaffTraveler } from "./types";

type ImportSourceType =
  | "validated_roster"
  | "detailed_orders"
  | "companions_vips"
  | "agency_rooming";
type ImportPreview = {
  previewId: string;
  sourceType: ImportSourceType;
  summary: Record<string, number>;
  staffRows?: {
    row: number;
    firstName: string;
    lastName: string;
    email: string;
    proposedRole: "companion" | "traveler";
    isVip: boolean;
    existingRole: string | null;
    action: "create" | "update";
  }[];
  availableMembers?: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  }[];
  agencyRows?: {
    row: number;
    firstName: string;
    lastName: string;
    outboundSeat: string | null;
    returnSeat: string | null;
    matchCount: number;
    previousOutboundSeat: string | null;
    previousReturnSeat: string | null;
  }[];
  changes?: {
    reference: string;
    action: string;
    fields: string[];
  }[];
};

export function StaffTools({
  tripId,
  tripName,
  isManager,
  onTripNameChange,
}: {
  tripId: string;
  tripName: string;
  isManager: boolean;
  onTripNameChange: (name: string) => void;
}) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [travelers, setTravelers] = useState<StaffTraveler[]>([]);
  const [travelerId, setTravelerId] = useState<string | null>(null);
  const [ticketKind, setTicketKind] = useState<string | null>(null);
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [agencyTemplateFile, setAgencyTemplateFile] = useState<File | null>(
    null,
  );
  const [importSourceType, setImportSourceType] =
    useState<ImportSourceType>("validated_roster");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [managerEmails, setManagerEmails] = useState<string[]>([]);
  const [accountMappings, setAccountMappings] = useState<
    Record<string, string>
  >({});
  const [editableTripName, setEditableTripName] = useState(tripName);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setEditableTripName(tripName);
  }, [tripName]);

  const refreshTravelers = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/travelers`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const data = (await response.json()) as { travelers: StaffTraveler[] };
      setTravelers(data.travelers);
    } catch {
      setMessage(t("theTravelerListCouldNotBeLoadedRightNow"));
    }
  }, [tripId, t]);

  useEffect(() => {
    void refreshTravelers();
  }, [refreshTravelers]);

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
    const form = new FormData();
    form.set("file", ticketFile);
    form.set("kind", ticketKind);
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(travelerId)}/tickets`,
      { method: "POST", body: form },
    );
    if (!response.ok) {
      setMessage(
        response.status === 503
          ? t("ticketStorageIsNotConfiguredInThisEnvironment")
          : t("theTicketCouldNotBeUploadedCheckTheFileTypeAndSize"),
      );
      return;
    }
    setTicketFile(null);
    setMessage(t("theTravelTicketHasBeenAdded"));
  }

  async function previewParticipantImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importFile) {
      setMessage(t("chooseAnExcelSpreadsheetToImport"));
      return;
    }
    if (importFile.size > 4 * 1024 * 1024) {
      setMessage(t("theExcelSpreadsheetMustBeNoLargerThan4Mb"));
      return;
    }
    const form = new FormData();
    form.set("file", importFile);
    form.set("sourceType", importSourceType);
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/imports/preview`,
      { method: "POST", body: form },
    );
    const result = (await response.json().catch(() => ({}))) as {
      previewId?: string;
      sourceType?: ImportSourceType;
      summary?: Record<string, number>;
      staffRows?: ImportPreview["staffRows"];
      availableMembers?: ImportPreview["availableMembers"];
      agencyRows?: ImportPreview["agencyRows"];
      changes?: ImportPreview["changes"];
      errors?: { row: number; field: string; message: string }[];
    };
    if (!response.ok) {
      setMessage(
        result.errors?.map((error) => formatImportError(error, t)).join("\n") ??
          t("theFileImportFailed"),
      );
      return;
    }
    if (!result.previewId || !result.sourceType || !result.summary) {
      setMessage(t("theImportSummaryCouldNotBeLoaded"));
      return;
    }
    setImportPreview({
      previewId: result.previewId,
      sourceType: result.sourceType,
      summary: result.summary,
      ...(result.staffRows ? { staffRows: result.staffRows } : {}),
      ...(result.availableMembers
        ? { availableMembers: result.availableMembers }
        : {}),
      ...(result.agencyRows ? { agencyRows: result.agencyRows } : {}),
      ...(result.changes ? { changes: result.changes } : {}),
    });
    setManagerEmails([]);
    setAccountMappings({});
    setMessage(t("reviewTheSummaryBeforeConfirmingTheImport"));
  }

  async function commitParticipantImport() {
    if (!importFile || !importPreview) return;
    const form = new FormData();
    form.set("file", importFile);
    form.set("sourceType", importPreview.sourceType);
    form.set("previewId", importPreview.previewId);
    if (importPreview.sourceType === "companions_vips") {
      form.set("managerEmails", JSON.stringify(managerEmails));
      form.set("accountMappings", JSON.stringify(accountMappings));
    }
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/imports/commit`,
      { method: "POST", body: form },
    );
    const result = (await response.json().catch(() => ({}))) as {
      errors?: { row: number; field: string; message: string }[];
    };
    if (!response.ok) {
      setImportPreview(null);
      setMessage(
        result.errors?.map((error) => formatImportError(error, t)).join("\n") ??
          t("theImportFailedReviewTheSpreadsheetAgain"),
      );
      return;
    }
    setMessage(
      t("importCompleteInformationAddedByTheOrganizersHasBeenPreserved"),
    );
    setImportFile(null);
    setImportPreview(null);
    setManagerEmails([]);
    setAccountMappings({});
    await refreshTravelers();
  }

  function toggleManagerEmail(email: string) {
    setManagerEmails((current) =>
      current.includes(email)
        ? current.filter((item) => item !== email)
        : [...current, email],
    );
  }

  async function saveTripName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editableTripName }),
    });
    if (!response.ok) {
      setMessage(t("theTripNameCouldNotBeUpdated"));
      return;
    }
    onTripNameChange(editableTripName.trim());
    setMessage(t("theTripNameHasBeenUpdated"));
  }

  async function prepareAgencySpreadsheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agencyTemplateFile) return;
    const form = new FormData();
    form.set("file", agencyTemplateFile);
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/rooms/agency-export`,
        { method: "POST", body: form },
      );
      if (!response.ok) throw new Error("agency_export_failed");
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename =
        disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ??
        disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
        "rooming-agency.xlsx";
      const downloadUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = decodeURIComponent(filename);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
      setMessage(t("agencySpreadsheetIsReady"));
    } catch {
      setMessage(t("agencySpreadsheetCouldNotBePrepared"));
    }
  }

  return (
    <section className="grid gap-5" aria-labelledby="staff-tools-title">
      <div className="grid gap-1">
        <div>
          <h3 className="text-lg font-bold" id="staff-tools-title">
            {t("organizerTools")}
          </h3>
          <p className="text-sm leading-relaxed text-content-muted">
            {t("transportRoomingAndParticipantInformation")}
          </p>
        </div>
      </div>
      <Tabs className="grid gap-5" defaultSelectedKey="participants">
        <TabList
          className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-control border border-border bg-surface-muted p-1"
          aria-label={t("organizerSections")}
        >
          <Tab
            id="participants"
            className="relative isolate cursor-pointer rounded-control px-4 py-2 text-sm font-semibold text-content-muted outline-none transition-colors data-[selected]:text-content data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus"
          >
            {({ isSelected }) => (
              <>
                {isSelected && (
                  <TabSelectionIndicator
                    reduceMotion={Boolean(shouldReduceMotion)}
                  />
                )}
                <span className="relative z-10 whitespace-nowrap">
                  {t("participantsAndUsers")}
                </span>
              </>
            )}
          </Tab>
          {isManager && (
            <Tab
              id="imports"
              className="relative isolate cursor-pointer rounded-control px-4 py-2 text-sm font-semibold text-content-muted outline-none transition-colors data-[selected]:text-content data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus"
            >
              {({ isSelected }) => (
                <>
                  {isSelected && (
                    <TabSelectionIndicator
                      reduceMotion={Boolean(shouldReduceMotion)}
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">
                    {t("importsAndExports")}
                  </span>
                </>
              )}
            </Tab>
          )}
          {isManager && (
            <Tab
              id="trip"
              className="relative isolate cursor-pointer rounded-control px-4 py-2 text-sm font-semibold text-content-muted outline-none transition-colors data-[selected]:text-content data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus"
            >
              {({ isSelected }) => (
                <>
                  {isSelected && (
                    <TabSelectionIndicator
                      reduceMotion={Boolean(shouldReduceMotion)}
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">
                    {t("tripAndOptions")}
                  </span>
                </>
              )}
            </Tab>
          )}
        </TabList>
        <TabPanel id="participants" className="grid gap-5 outline-none">
          <ParticipantDirectory tripId={tripId} isManager={isManager} />
          <Form
            className="grid grid-cols-2 items-end gap-3 rounded-card border border-border bg-surface p-4 max-[420px]:grid-cols-1"
            onSubmit={uploadTicket}
          >
            <h4 className="col-span-full text-base font-bold">
              {t("addATravelTicket")}
            </h4>
            <Select
              className="grid min-w-0 gap-2"
              selectedKey={travelerId}
              onSelectionChange={(key) =>
                setTravelerId(key ? String(key) : null)
              }
              isRequired
            >
              <Label className={textFieldStyles().label()}>
                {t("traveler2")}
              </Label>
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
              onSelectionChange={(key) =>
                setTicketKind(key ? String(key) : null)
              }
              isRequired
            >
              <Label className={textFieldStyles().label()}>
                {t("journey")}
              </Label>
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
                onChange={(event) =>
                  setTicketFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <Button appearance="secondary" type="submit">
              {t("uploadTicket")}
            </Button>
          </Form>
        </TabPanel>
        {isManager && (
          <TabPanel id="imports" className="grid gap-5 outline-none">
            <Form
              className="grid grid-cols-2 items-end gap-3 rounded-card border border-border bg-surface p-4 max-[420px]:grid-cols-1"
              onSubmit={previewParticipantImport}
            >
              <h4 className="col-span-full text-base font-bold">
                {t("tripImports")}
              </h4>
              <p className="col-span-full text-sm leading-relaxed text-content-muted">
                {t(
                  "reviewTheSpreadsheetAndItsChangesBeforeConfirmingTheImportEachSourceTypeFollowsItsOwnRules",
                )}
              </p>
              <p className="col-span-full rounded-control bg-surface-muted px-3 py-2 text-sm leading-relaxed text-content-muted">
                {t("detailedImportDescription")}
              </p>
              <Select
                className="col-span-full grid gap-2"
                selectedKey={importSourceType}
                onSelectionChange={(key) => {
                  if (key) {
                    setImportSourceType(key as ImportSourceType);
                    setImportPreview(null);
                  }
                }}
              >
                <Label className={textFieldStyles().label()}>
                  {t("spreadsheetType")}
                </Label>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <Popover>
                  <ListBox className={listBoxStyles().list()}>
                    <ListBoxItem
                      className={listBoxStyles().item()}
                      id="validated_roster"
                    >
                      {t("confirmedParticipantList")}
                    </ListBoxItem>
                    <ListBoxItem
                      className={listBoxStyles().item()}
                      id="detailed_orders"
                    >
                      {t("detailedOrderList")}
                    </ListBoxItem>
                    <ListBoxItem
                      className={listBoxStyles().item()}
                      id="companions_vips"
                    >
                      {t("companionsAndVips")}
                    </ListBoxItem>
                    <ListBoxItem
                      className={listBoxStyles().item()}
                      id="agency_rooming"
                    >
                      {t("roomingListReturnedByTheAgency")}
                    </ListBoxItem>
                  </ListBox>
                </Popover>
              </Select>
              <div className="col-span-full">
                <FileDropZone
                  file={importFile}
                  label={t("dropSpreadsheetOrBrowse")}
                  description={t("excelSpreadsheetXlsx")}
                  acceptedFileTypes={[
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  ]}
                  extensions={[".xlsx"]}
                  onFileChange={(file) => {
                    setImportFile(file);
                    setImportPreview(null);
                  }}
                />
              </div>
              <Button
                appearance="secondary"
                type="submit"
                isDisabled={!importFile}
              >
                {t("reviewSpreadsheet")}
              </Button>
              {importPreview && (
                <div className="col-span-full grid gap-3 rounded-card border border-border bg-surface-muted p-4">
                  <h5 className="text-sm font-bold">{t("importPreview")}</h5>
                  <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    {Object.entries(importPreview.summary).map(
                      ([key, value]) => (
                        <div key={key}>
                          <dt className="text-content-muted">
                            {importSummaryLabel(key, t)}
                          </dt>
                          <dd className="font-semibold">{value}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                  {importPreview.changes?.length ? (
                    <div className="grid max-h-72 gap-1 overflow-auto rounded-lg border border-border bg-surface p-3 text-sm">
                      <h6 className="font-semibold">
                        {t("changesByReference")}
                      </h6>
                      {importPreview.changes.map((change) => (
                        <p
                          className="border-t border-border py-2"
                          key={`${change.reference}-${change.action}`}
                        >
                          <span className="font-semibold">
                            {change.reference}
                          </span>
                          <span> · {importChangeLabel(change.action, t)}</span>
                          {change.fields.length ? (
                            <span className="text-content-muted">
                              {" "}
                              —{" "}
                              {change.fields.map((field) => t(field)).join(",")}
                            </span>
                          ) : null}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {importPreview.staffRows?.length ? (
                    <fieldset className="grid gap-2">
                      <legend className="text-sm font-semibold">
                        {t("selectJoffrayAndStephaneAsManagers")}
                      </legend>
                      {importPreview.staffRows.map((person) => (
                        <div
                          className="grid gap-2 rounded-lg border border-border bg-surface p-3"
                          key={person.email}
                        >
                          <Checkbox
                            className={checkboxStyles()}
                            isSelected={managerEmails.includes(person.email)}
                            onChange={() => toggleManagerEmail(person.email)}
                          >
                            <span>
                              {person.firstName} {person.lastName}
                              <span className="block text-xs text-content-muted">
                                {person.email} ·{" "}
                                {person.isVip
                                  ? t("vipTraveler")
                                  : t(person.proposedRole)}
                                {person.existingRole
                                  ? ` · ${t("currentRoleRole", { role: t(person.existingRole) })}`
                                  : ""}
                              </span>
                            </span>
                          </Checkbox>
                          {importPreview.availableMembers?.length ? (
                            <Select
                              className="grid min-w-0 gap-2"
                              selectedKey={
                                accountMappings[person.email] ?? "new"
                              }
                              onSelectionChange={(key) =>
                                setAccountMappings((current) => {
                                  const next = { ...current };
                                  if (key === "new" || key === null) {
                                    delete next[person.email];
                                  } else {
                                    next[person.email] = String(key);
                                  }
                                  return next;
                                })
                              }
                            >
                              <Label className={textFieldStyles().label()}>
                                {t("accountToLink")}
                              </Label>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <Popover>
                                <ListBox className={listBoxStyles().list()}>
                                  <ListBoxItem
                                    className={listBoxStyles().item()}
                                    id="new"
                                  >
                                    {t("createAnAccountWithThisEmail")}
                                  </ListBoxItem>
                                  {importPreview.availableMembers.map(
                                    (member) => (
                                      <ListBoxItem
                                        className={listBoxStyles().item()}
                                        id={member.userId}
                                        key={member.userId}
                                        isDisabled={Object.entries(
                                          accountMappings,
                                        ).some(
                                          ([sourceEmail, userId]) =>
                                            sourceEmail !== person.email &&
                                            userId === member.userId,
                                        )}
                                      >
                                        {member.firstName} {member.lastName} ·{" "}
                                        {member.email} · {t(member.role)}
                                      </ListBoxItem>
                                    ),
                                  )}
                                </ListBox>
                              </Popover>
                            </Select>
                          ) : null}
                        </div>
                      ))}
                    </fieldset>
                  ) : null}
                  {importPreview.agencyRows?.length ? (
                    <div className="grid max-h-64 gap-2 overflow-auto text-sm">
                      {importPreview.agencyRows.map((person) => (
                        <p
                          className="rounded-lg border border-border bg-surface p-3"
                          key={`${person.row}-${person.lastName}-${person.firstName}`}
                        >
                          <span className="font-semibold">
                            {person.firstName} {person.lastName}
                          </span>
                          <span className="block text-content-muted">
                            {person.matchCount === 1
                              ? t(
                                  "seatsOutboundpreviousOutboundReturnReturnpreviousReturn",
                                  {
                                    outboundPrevious:
                                      person.previousOutboundSeat ?? "—",
                                    outbound: person.outboundSeat ?? "—",
                                    returnPrevious:
                                      person.previousReturnSeat ?? "—",
                                    return: person.returnSeat ?? "—",
                                  },
                                )
                              : person.matchCount === 0
                                ? t(
                                    "noMatchingAccountWasFoundCheckTheExactSpelling",
                                  )
                                : t(
                                    "severalAccountsHaveThisNameCheckTheNamesInTheSpreadsheet",
                                  )}
                          </span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <Button
                    appearance="primary"
                    type="button"
                    isDisabled={Boolean(
                      importPreview.summary.unmatched ||
                        importPreview.summary.ambiguous,
                    )}
                    onPress={commitParticipantImport}
                  >
                    {t("confirmImport")}
                  </Button>
                </div>
              )}
            </Form>
            <a
              className={buttonStyles({ appearance: "secondary" })}
              href={`/api/trips/${encodeURIComponent(tripId)}/rooms/export`}
            >
              {t("exportTheRoomingSummary")}
            </a>
            <Form
              className="grid gap-3 rounded-card border border-border bg-surface p-4"
              onSubmit={prepareAgencySpreadsheet}
            >
              <h4 className="text-base font-bold">
                {t("prepareTheAgencySpreadsheet")}
              </h4>
              <p className="text-sm text-content-muted">
                {t(
                  "uploadThe2025MatriceRoominglisteSkiOnePointXlsxTemplateToFillItWithRoomsTravelersDietaryRequirementsAndTransportInformationKeepTheTrainSeatColumnsFromTheTemplate",
                )}
              </p>
              <FileDropZone
                file={agencyTemplateFile}
                label={t("dropSpreadsheetOrBrowse")}
                description={t("excelSpreadsheetXlsx")}
                acceptedFileTypes={[
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ]}
                extensions={[".xlsx"]}
                onFileChange={setAgencyTemplateFile}
              />
              <Button
                appearance="secondary"
                type="submit"
                isDisabled={!agencyTemplateFile}
              >
                {t("downloadTheCompletedAgencySpreadsheet")}
              </Button>
            </Form>
          </TabPanel>
        )}
        {isManager && (
          <TabPanel id="trip" className="grid gap-5 outline-none">
            <section
              className="grid gap-2"
              aria-labelledby="trip-settings-title"
            >
              <h4 className="text-base font-bold" id="trip-settings-title">
                {t("tripInformation")}
              </h4>
              <p className="text-sm leading-relaxed text-content-muted">
                {t("manageTripAndOptionsDescription")}
              </p>
            </section>
            <Form
              className="grid grid-cols-2 items-end gap-3 rounded-card border border-border bg-surface p-4 max-[420px]:grid-cols-1"
              onSubmit={saveTripName}
            >
              <TextField
                className="grid min-w-0 gap-2"
                value={editableTripName}
                onChange={setEditableTripName}
                isRequired
              >
                <Label className={textFieldStyles().label()}>
                  {t("tripName")}
                </Label>
                <Input className={textFieldStyles().input()} maxLength={120} />
              </TextField>
              <Button appearance="secondary" type="submit">
                {t("save")}
              </Button>
            </Form>
          </TabPanel>
        )}
      </Tabs>
      {message && (
        <p
          className={`${messageStyles()} whitespace-pre-line`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </section>
  );
}

function TabSelectionIndicator({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      className="absolute inset-0 z-0 rounded-control bg-surface shadow-sm"
      layoutId="organizer-tab-selection"
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 520, damping: 38 }
      }
    />
  );
}

function importSummaryLabel(key: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    added: "toAdd",
    updated: "toUpdate",
    unchanged: "unchangedItems",
    removed: "missingFromTheNewSnapshot",
    missingDetail: "withoutDetailedInformation",
    orders: "orders",
    rows: "people",
    matched: "exactMatches",
    unmatched: "namesNotFound",
    ambiguous: "ambiguousNames",
    outboundPlacements: "outboundPlacements",
    returnPlacements: "returnPlacements",
  };
  return t(labels[key] ?? key);
}

function importChangeLabel(action: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    added: "toAdd2",
    updated: "toUpdate2",
    unchanged: "unchangedItems",
    removed: "toCancel",
    enriched: "existingDetails",
    new_detail: "newDetails",
  };
  return t(labels[action] ?? action);
}

function translateSourceText(value: string, t: TFunction) {
  const key = getTranslationKeyForFrenchSourceText(value);
  return key ? t(key) : value;
}

function formatImportError(
  error: { row: number; field: string; message: string },
  t: TFunction,
) {
  const message = error.message;
  const duplicateReference =
    /^Référence (déjà utilisée|en double) ligne (\d+)\.$/.exec(message);
  const duplicateEmail = /^Adresse déjà utilisée ligne (\d+)\.$/.exec(message);
  const duplicatePerson = /^Personne en double \(ligne (\d+)\)\.$/.exec(
    message,
  );
  const rowLimit =
    /^Le fichier dépasse la limite de (\d+) (commandes|voyageurs|lignes)\.$/.exec(
      message,
    );
  const missingColumns = /^Colonne\(s\) absente\(s\) : (.+)\.$/.exec(message);
  const missingColumn = /^Colonne obligatoire absente : (.+)\.$/.exec(message);
  const duplicateReferenceRow = duplicateReference?.[2];
  const duplicateEmailRow = duplicateEmail?.[1];
  const duplicatePersonRow = duplicatePerson?.[1];
  const rowLimitCount = rowLimit?.[1];
  const rowLimitKind = rowLimit?.[2];
  const missingColumnNames = missingColumns?.[1];
  const missingColumnName = missingColumn?.[1];
  let localizedMessage = message;
  if (duplicateReference && duplicateReferenceRow) {
    localizedMessage = t(
      duplicateReference[1] === "en double"
        ? "duplicateReferenceOnRowRow"
        : "referenceAlreadyUsedOnRowRow",
      { row: duplicateReferenceRow },
    );
  } else if (duplicateEmailRow) {
    localizedMessage = t("addressAlreadyUsedOnRowRow", {
      row: duplicateEmailRow,
    });
  } else if (duplicatePersonRow) {
    localizedMessage = t("duplicatePersonRowRow", {
      row: duplicatePersonRow,
    });
  } else if (rowLimitCount && rowLimitKind) {
    localizedMessage = t("theFileExceedsTheLimitOfCountKind", {
      count: rowLimitCount,
      kind: t(
        (
          {
            commandes: "orders",
            voyageurs: "travelers",
            lignes: "rows",
          } as Record<string, string>
        )[rowLimitKind] ?? "rows",
      ),
    });
  } else if (missingColumnNames) {
    localizedMessage = t("missingColumnSColumns", {
      columns: missingColumnNames
        .split(",")
        .map((column) => translateSourceText(column, t))
        .join(","),
    });
  } else if (missingColumnName) {
    localizedMessage = t("requiredColumnMissingColumn", {
      column: translateSourceText(missingColumnName, t),
    });
  } else {
    localizedMessage = translateSourceText(message, t);
  }
  return t("rowRowFieldMessage", {
    row: error.row,
    field: translateSourceText(error.field, t),
    message: localizedMessage,
  });
}
