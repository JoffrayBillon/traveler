import type { RoomInventoryItem } from "@traveler/api/rooming/rooming.types";
import { Button, textFieldStyles } from "@traveler/components/ui";
import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Form, Input, Label, TextField } from "react-aria-components";
import { useTranslation } from "react-i18next";

const defaultInventory = [
  { capacity: 3, quantity: 18 },
  { capacity: 4, quantity: 29 },
];

type RoomInventoryDraft = RoomInventoryItem & { id: string };

export function RoomInventoryEditor({
  inventory = defaultInventory,
  isLocked,
  isSaving,
  onSave,
}: {
  inventory?: RoomInventoryItem[] | undefined;
  isLocked: boolean;
  isSaving: boolean;
  onSave: (inventory: RoomInventoryItem[]) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<RoomInventoryDraft[]>(() =>
    inventory.map((item) => ({ ...item, id: String(item.capacity) })),
  );
  useEffect(
    () =>
      setDraft(
        inventory.map((item) => ({ ...item, id: String(item.capacity) })),
      ),
    [inventory],
  );

  function update(
    index: number,
    field: keyof RoomInventoryItem,
    value: string,
  ) {
    const number = Number(value);
    setDraft((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: number } : item,
      ),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(draft.map(({ capacity, quantity }) => ({ capacity, quantity })));
  }

  return (
    <section className="grid gap-3 rounded-card border border-border p-4">
      <div className="grid gap-1">
        <h5 className="font-semibold">{t("roomInventory")}</h5>
        <p className="text-sm text-content-muted">
          {isLocked ? t("roomInventoryLocked") : t("roomInventoryDescription")}
        </p>
      </div>
      <Form className="grid gap-3" onSubmit={submit}>
        {draft.map((item, index) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 max-[420px]:grid-cols-1"
            key={item.id}
          >
            <TextField
              className="grid min-w-0 gap-2"
              value={String(item.capacity)}
              onChange={(value) => update(index, "capacity", value)}
              isRequired
              isDisabled={isLocked}
            >
              <Label className={textFieldStyles().label()}>
                {t("roomCapacity")}
              </Label>
              <Input
                className={textFieldStyles().input()}
                type="number"
                min="1"
                max="12"
              />
            </TextField>
            <TextField
              className="grid min-w-0 gap-2"
              value={String(item.quantity)}
              onChange={(value) => update(index, "quantity", value)}
              isRequired
              isDisabled={isLocked}
            >
              <Label className={textFieldStyles().label()}>
                {t("roomQuantity")}
              </Label>
              <Input
                className={textFieldStyles().input()}
                type="number"
                min="0"
                max="200"
              />
            </TextField>
            <Button
              appearance="quiet"
              aria-label={t("removeRoomCapacity")}
              isDisabled={isLocked || draft.length <= 1}
              onPress={() =>
                setDraft((current) => current.filter((_, i) => i !== index))
              }
            >
              <Trash2 aria-hidden="true" size={18} />
            </Button>
          </div>
        ))}
        {!isLocked && (
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              appearance="quiet"
              onPress={() =>
                setDraft((current) => [
                  ...current,
                  { id: crypto.randomUUID(), capacity: 2, quantity: 0 },
                ])
              }
            >
              <Plus aria-hidden="true" size={18} />
              {t("addRoomCapacity")}
            </Button>
            <Button appearance="secondary" type="submit" isDisabled={isSaving}>
              {isSaving ? t("saving") : t("saveRoomInventory")}
            </Button>
          </div>
        )}
      </Form>
    </section>
  );
}
