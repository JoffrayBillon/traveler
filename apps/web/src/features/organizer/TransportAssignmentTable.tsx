import { useTransportMutations } from "@traveler/api/transport/mutations";
import type {
  TransportGroup,
  TransportView,
} from "@traveler/api/transport/transport.types";
import {
  listBoxStyles,
  messageStyles,
  SelectTrigger,
  textFieldStyles,
} from "@traveler/components/ui";
import { useState } from "react";
import {
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { useTranslation } from "react-i18next";

export function TransportAssignmentTable({
  tripId,
  groups,
  participants,
}: {
  tripId: string;
  groups: TransportGroup[];
  participants: TransportView["participants"];
}) {
  const { t } = useTranslation();
  const mutations = useTransportMutations(tripId);
  const [message, setMessage] = useState("");

  async function assign(userId: string, selected: string) {
    setMessage("");
    try {
      if (selected === "none" || selected === "unconfirmed") {
        await mutations.setParticipantTransport.mutateAsync({
          userId,
          choice: selected,
          groupId: null,
        });
      } else {
        await mutations.setParticipantTransport.mutateAsync({
          userId,
          choice: "group",
          groupId: selected,
        });
      }
      setMessage(t("transportAssignmentSaved"));
    } catch {
      setMessage(t("transportAssignmentCouldNotBeSaved"));
    }
  }

  return (
    <section
      className="grid gap-3"
      aria-labelledby="transport-assignments-title"
    >
      <header className="grid gap-1">
        <h4 className="text-base font-bold" id="transport-assignments-title">
          {t("travelerTransportAssignments")}
        </h4>
        <p className="text-sm text-content-muted">
          {t("assignTransportGroupDescription")}
        </p>
      </header>
      {participants.map((person) => {
        const selected =
          person.transportChoice === "group" && person.groupId
            ? person.groupId
            : person.transportChoice;
        return (
          <div
            className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,auto)] sm:items-center"
            key={person.userId}
          >
            <div className="grid min-w-0 gap-1">
              <strong className="truncate">
                {person.firstName} {person.lastName}
              </strong>
              <span className="truncate text-sm text-content-muted">
                {person.email}
              </span>
            </div>
            <Select
              className="grid min-w-0 gap-2"
              selectedKey={selected}
              onSelectionChange={(key) => {
                if (key) void assign(person.userId, String(key));
              }}
              isDisabled={mutations.setParticipantTransport.isPending}
            >
              <Label className={textFieldStyles().label()}>
                {t("transportAssignment")}
              </Label>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <Popover>
                <ListBox className={listBoxStyles().list()}>
                  <ListBoxItem
                    id="unconfirmed"
                    className={listBoxStyles().item()}
                  >
                    {t("toBeConfirmed")}
                  </ListBoxItem>
                  <ListBoxItem id="none" className={listBoxStyles().item()}>
                    {t("noGroupTransport")}
                  </ListBoxItem>
                  {groups.map((group) => (
                    <ListBoxItem
                      id={group.id}
                      key={group.id}
                      className={listBoxStyles().item()}
                    >
                      {group.name} · {group.sourceCity}
                    </ListBoxItem>
                  ))}
                </ListBox>
              </Popover>
            </Select>
          </div>
        );
      })}
      {message && (
        <p className={messageStyles()} role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}
