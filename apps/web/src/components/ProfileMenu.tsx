import type { ThemePreference } from "@traveler/hooks/useThemePreference";
import type { TranslationKey } from "@traveler/i18n/resources";
import type { TravelerProfile } from "@traveler/types/profile";
import {
  ChevronDown,
  LogOut,
  Monitor,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Popover,
  SelectionIndicator,
  ToggleButton,
  ToggleButtonGroup,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { buttonStyles, messageStyles } from "./ui";

const themeOptions: {
  id: ThemePreference;
  labelKey: TranslationKey;
  Icon: typeof Monitor;
}[] = [
  { id: "system", labelKey: "system", Icon: Monitor },
  { id: "light", labelKey: "light", Icon: Sun },
  { id: "dark", labelKey: "dark", Icon: Moon },
];

export function ProfileMenu({
  profile,
  preference,
  profileError,
  onPreferenceChange,
  onSignOut,
}: {
  profile: TravelerProfile;
  preference: ThemePreference;
  profileError: string;
  onPreferenceChange: (preference: ThemePreference) => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const selectedKeys = new Set([preference]);
  const tripCount =
    profile.trips.length === 1
      ? t("countTripLinked", { count: 1 })
      : t("countTripsLinked", { count: profile.trips.length });

  return (
    <DialogTrigger>
      <Button
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-3 text-sm font-semibold text-content transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        aria-label={`${t("accountFor")} ${profile.user.name}`}
      >
        <span className="grid size-8 place-items-center rounded-full bg-surface-muted text-accent">
          <UserRound aria-hidden="true" size={17} />
        </span>
        <span className="max-w-32 truncate max-[480px]:hidden">
          {profile.user.name.split(" ")[0]}
        </span>
        <ChevronDown aria-hidden="true" size={15} />
      </Button>
      <Popover
        placement="bottom end"
        className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-4 text-content shadow-panel outline-none data-[entering]:animate-[popover-in_140ms_ease-out] data-[exiting]:animate-[popover-out_100ms_ease-in]"
      >
        <Dialog
          aria-label={t("profileAndPreferences")}
          className="grid gap-4 outline-none"
        >
          <section className="flex min-w-0 items-center gap-3 border-b border-border pb-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-card bg-surface-muted text-accent">
              <UserRound aria-hidden="true" size={21} />
            </span>
            <div className="grid min-w-0 flex-1 gap-1">
              <Heading slot="title" className="truncate text-base font-bold">
                {profile.user.name}
              </Heading>
              <p
                className="truncate text-sm text-content-muted"
                title={profile.user.email}
              >
                {profile.user.email}
              </p>
              <p className="text-xs text-content-subtle">{tripCount}</p>
            </div>
          </section>

          <fieldset className="grid gap-2 border-0 p-0">
            <legend className="text-sm font-semibold text-content-muted">
              {t("appearance")}
            </legend>
            <ToggleButtonGroup
              aria-label={t("interfaceTheme")}
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={selectedKeys}
              onSelectionChange={(keys) => {
                const next = [...keys][0];
                if (next === "system" || next === "light" || next === "dark")
                  onPreferenceChange(next);
              }}
              className="grid grid-cols-3 gap-1 rounded-control bg-surface-muted p-1"
            >
              {themeOptions.map(({ id, labelKey, Icon }) => (
                <ToggleButton
                  className="relative inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-content-muted transition-colors hover:text-content focus-visible:outline-2 focus-visible:outline-focus data-[selected]:bg-surface data-[selected]:text-content data-[selected]:shadow-sm"
                  key={id}
                  id={id}
                  aria-label={t(labelKey)}
                >
                  <SelectionIndicator
                    data-selected
                    className="absolute inset-0 rounded-lg bg-surface shadow-sm transition-[translate,opacity] duration-200 ease-out motion-reduce:duration-0"
                  />
                  <Icon
                    className="relative z-10"
                    aria-hidden="true"
                    size={16}
                  />
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </fieldset>

          <LanguageSwitcher />

          {profileError && (
            <p className={messageStyles({ tone: "danger" })} role="alert">
              {profileError}
            </p>
          )}
          <Button
            className={buttonStyles({
              appearance: "secondary",
              class: "w-full justify-center",
            })}
            onPress={onSignOut}
          >
            <LogOut aria-hidden="true" size={17} /> {t("signOut")}
          </Button>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
