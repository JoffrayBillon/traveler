import type { TransportGroup } from "@traveler/api/transport/transport.types";
import {
  Button,
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "@traveler/components/ui";
import {
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { roleTranslationKey } from "./participant-formatters";

export const defaultParticipantFilters = {
  payment: "all",
  role: "all",
  activity: "all",
  transport: "all",
};

type Filters = typeof defaultParticipantFilters;

export function ParticipantFilters({
  filters,
  groups,
  isManager,
  onChange,
}: {
  filters: Filters;
  groups: TransportGroup[];
  isManager: boolean;
  onChange: (filters: Filters) => void;
}) {
  const { t } = useTranslation();
  const fields: {
    key: keyof Filters;
    label: string;
    options: [string, string][];
  }[] = [
    {
      key: "role",
      label: t("role"),
      options: [
        ["traveler", t(roleTranslationKey("traveler"))],
        ["companion", t(roleTranslationKey("companion"))],
        ["manager", t(roleTranslationKey("manager"))],
      ],
    },
    {
      key: "activity",
      label: t("participantFilterActivity"),
      options: [
        ["ski", t("ski")],
        ["spa", t("spa")],
        ["unset", t("toBeConfirmed")],
      ],
    },
    {
      key: "transport",
      label: t("transportAssignment"),
      options: [
        ["none", t("noGroupTransport")],
        ["unconfirmed", t("toBeConfirmed")],
        ...groups.map((group): [string, string] => [
          `group:${group.id}`,
          `${group.name} · ${group.sourceCity}`,
        ]),
      ],
    },
  ];
  if (isManager) {
    fields.unshift({
      key: "payment",
      label: t("payment"),
      options: [
        ["paid", t("paid")],
        ["partially_paid", t("partiallyPaid")],
        ["unpaid", t("unpaid")],
        ["unset", t("unknownPayment")],
      ],
    });
  }
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(({ key, label, options }) => (
          <Select
            className="grid min-w-0 gap-2"
            key={key}
            selectedKey={filters[key]}
            onSelectionChange={(value) => {
              if (typeof value === "string")
                onChange({ ...filters, [key]: value });
            }}
          >
            <Label className={textFieldStyles().label()}>{label}</Label>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <Popover>
              <ListBox className={listBoxStyles().list()}>
                <ListBoxItem id="all" className={listBoxStyles().item()}>
                  {t("allFilterValues")}
                </ListBoxItem>
                {options.map(([id, name]) => (
                  <ListBoxItem
                    key={id}
                    id={id}
                    className={listBoxStyles().item()}
                  >
                    {name}
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
        ))}
      </div>
      {fields.some(({ key }) => filters[key] !== "all") && (
        <Button
          appearance="quiet"
          className="justify-self-start"
          onPress={() => onChange(defaultParticipantFilters)}
        >
          {t("resetParticipantFilters")}
        </Button>
      )}
    </div>
  );
}
