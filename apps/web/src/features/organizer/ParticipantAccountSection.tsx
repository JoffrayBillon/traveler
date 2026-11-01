import {
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { SelectTrigger, textFieldStyles } from "../../components/ui";
import { ProfileText } from "./ProfileText";
import type { ProfileDraft } from "./participant-directory.types";
import { roleTranslationKey } from "./participant-formatters";
import type { StaffTraveler } from "./types";

type ParticipantAccountSectionProps = {
  profile: ProfileDraft;
  email: string;
  onEmailChange: (email: string) => void;
  role: StaffTraveler["role"];
  onRoleChange: (role: StaffTraveler["role"]) => void;
  isManager: boolean;
  onProfileChange: <K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) => void;
};

export function ParticipantAccountSection({
  profile,
  email,
  onEmailChange,
  role,
  onRoleChange,
  isManager,
  onProfileChange,
}: ParticipantAccountSectionProps) {
  const { t } = useTranslation();
  function changeProfile<K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) {
    onProfileChange(key, value);
  }
  return (
    <section className="grid gap-4" aria-labelledby="user-account-title">
      <h3 className="text-base font-bold" id="user-account-title">
        {t("accountInformation")}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <ProfileText
          label={t("firstName")}
          value={profile.firstName}
          onChange={(value) => changeProfile("firstName", value)}
        />
        <ProfileText
          label={t("lastName")}
          value={profile.lastName}
          onChange={(value) => changeProfile("lastName", value)}
        />
        <TextField
          className="grid min-w-0 gap-2"
          type="email"
          value={email}
          onChange={onEmailChange}
          isDisabled={!isManager}
        >
          <Label className={textFieldStyles().label()}>
            {t("emailAddress")}
          </Label>
          <Input className={textFieldStyles().input()} autoComplete="email" />
        </TextField>
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={role}
          onSelectionChange={(key) =>
            key && onRoleChange(String(key) as StaffTraveler["role"])
          }
          isDisabled={!isManager}
        >
          <Label className={textFieldStyles().label()}>{t("role")}</Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <Popover>
            <ListBox className="grid gap-1 rounded-card border border-border bg-surface p-1.5 shadow-panel">
              {(["traveler", "companion", "manager"] as const).map((value) => (
                <ListBoxItem
                  className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted data-[selected]:bg-surface-muted"
                  id={value}
                  key={value}
                >
                  {t(roleTranslationKey(value))}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={profile.gender ?? "none"}
          onSelectionChange={(key) =>
            changeProfile("gender", key === "M" || key === "F" ? key : null)
          }
        >
          <Label className={textFieldStyles().label()}>{t("sex")}</Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <Popover>
            <ListBox className="grid gap-1 rounded-card border border-border bg-surface p-1.5 shadow-panel">
              <ListBoxItem
                id="none"
                className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
              >
                {t("notProvided")}
              </ListBoxItem>
              <ListBoxItem
                id="M"
                className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
              >
                {t("man")}
              </ListBoxItem>
              <ListBoxItem
                id="F"
                className="rounded-control px-3 py-2 outline-none data-[focused]:bg-surface-muted"
              >
                {t("woman")}
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
      </div>
    </section>
  );
}
