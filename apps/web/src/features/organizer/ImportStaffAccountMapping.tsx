import type { ImportPreview } from "@traveler/api/imports/import.types";
import {
  checkboxStyles,
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "@traveler/components/ui";
import { getTranslationKey } from "@traveler/i18n/resources";
import {
  Checkbox,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { roleTranslationKey } from "./participant-formatters";

type StaffRow = NonNullable<ImportPreview["staffRows"]>[number];
type Member = NonNullable<ImportPreview["availableMembers"]>[number];

export function ImportStaffAccountMapping({
  staffRows,
  members,
  excludedRows,
  setExcludedRows,
  managerEmails,
  toggleManagerEmail,
  accountMappings,
  setAccountMappings,
}: {
  staffRows: StaffRow[];
  members: Member[];
  excludedRows: number[];
  setExcludedRows: (update: (current: number[]) => number[]) => void;
  managerEmails: string[];
  toggleManagerEmail: (email: string) => void;
  accountMappings: Record<string, string>;
  setAccountMappings: (
    update: (current: Record<string, string>) => Record<string, string>,
  ) => void;
}) {
  const { t } = useTranslation();
  const includedEmails = new Set(
    staffRows
      .filter((person) => !excludedRows.includes(person.row))
      .map((person) => person.email.trim().toLowerCase()),
  );
  function translatedRole(role: string) {
    const translationKey = getTranslationKey(role);
    return translationKey ? t(translationKey) : role;
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold">
        {t("staffImportAccountSettings")}
      </legend>
      <p className="text-sm text-content-muted">
        {t("staffImportAccountEmailMatchingDescription")}
      </p>
      {staffRows.map((person) => (
        <div
          className={`grid gap-2 rounded-lg border border-border bg-surface p-3 ${excludedRows.includes(person.row) ? "opacity-60" : ""}`}
          key={person.email}
        >
          <Checkbox
            className={checkboxStyles()}
            isSelected={!excludedRows.includes(person.row)}
            onChange={() =>
              setExcludedRows((current) =>
                current.includes(person.row)
                  ? current.filter((row) => row !== person.row)
                  : [...current, person.row],
              )
            }
          >
            <span>
              {t("includeParticipantInImport", {
                name: `${person.firstName} ${person.lastName}`,
              })}
            </span>
          </Checkbox>
          <Checkbox
            className={checkboxStyles()}
            isSelected={managerEmails.includes(
              person.email.trim().toLowerCase(),
            )}
            isDisabled={excludedRows.includes(person.row)}
            onChange={() => toggleManagerEmail(person.email)}
          >
            <span>
              {person.firstName} {person.lastName}
              <span className="block text-xs text-content-muted">
                {person.email} ·{" "}
                {person.isVip
                  ? t("vipTraveler")
                  : t(roleTranslationKey(person.proposedRole))}
                {person.existingRole
                  ? ` · ${t("currentRoleRole", {
                      role: translatedRole(person.existingRole),
                    })}`
                  : ""}
              </span>
            </span>
          </Checkbox>
          {members.length > 0 && (
            <Select
              className="grid min-w-0 gap-2"
              isDisabled={excludedRows.includes(person.row)}
              selectedKey={
                accountMappings[person.email.trim().toLowerCase()] ?? "new"
              }
              onSelectionChange={(key) =>
                setAccountMappings((current) => {
                  const next = { ...current };
                  const email = person.email.trim().toLowerCase();
                  if (key === "new" || key === null) delete next[email];
                  else next[email] = String(key);
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
                  <ListBoxItem className={listBoxStyles().item()} id="new">
                    {t("createAnAccountWithThisEmail")}
                  </ListBoxItem>
                  {members.map((member) => (
                    <ListBoxItem
                      className={listBoxStyles().item()}
                      id={member.userId}
                      key={member.userId}
                      isDisabled={Object.entries(accountMappings).some(
                        ([sourceEmail, userId]) =>
                          includedEmails.has(sourceEmail) &&
                          sourceEmail !== person.email.trim().toLowerCase() &&
                          userId === member.userId,
                      )}
                    >
                      {member.firstName} {member.lastName} · {member.email} ·{" "}
                      {translatedRole(member.role)}
                    </ListBoxItem>
                  ))}
                </ListBox>
              </Popover>
            </Select>
          )}
        </div>
      ))}
    </fieldset>
  );
}
