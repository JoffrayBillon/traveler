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
  managerEmails,
  toggleManagerEmail,
  accountMappings,
  setAccountMappings,
}: {
  staffRows: StaffRow[];
  members: Member[];
  managerEmails: string[];
  toggleManagerEmail: (email: string) => void;
  accountMappings: Record<string, string>;
  setAccountMappings: (
    update: (current: Record<string, string>) => Record<string, string>,
  ) => void;
}) {
  const { t } = useTranslation();
  function translatedRole(role: string) {
    const translationKey = getTranslationKey(role);
    return translationKey ? t(translationKey) : role;
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold">
        {t("selectJoffrayAndStephaneAsManagers")}
      </legend>
      {staffRows.map((person) => (
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
              selectedKey={accountMappings[person.email] ?? "new"}
              onSelectionChange={(key) =>
                setAccountMappings((current) => {
                  const next = { ...current };
                  if (key === "new" || key === null) delete next[person.email];
                  else next[person.email] = String(key);
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
                          sourceEmail !== person.email &&
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
