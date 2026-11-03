import { useRoomingMutations } from "@traveler/api/rooming/mutations";
import { useRoomInventoryQuery } from "@traveler/api/rooming/queries";
import type { RoomInventoryItem } from "@traveler/api/rooming/rooming.types";
import { messageStyles } from "@traveler/components/ui";
import { RoomInventoryEditor } from "@traveler/features/rooming/RoomInventoryEditor";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function TripRoomInventorySettings({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const query = useRoomInventoryQuery(tripId, true);
  const mutations = useRoomingMutations(tripId);
  const [message, setMessage] = useState("");

  async function saveInventory(inventory: RoomInventoryItem[]) {
    setMessage("");
    try {
      const result = await mutations.saveRoomInventory.mutateAsync(inventory);
      setMessage(
        result.added || result.removed
          ? t("roomInventorySavedWithChanges", result)
          : t("roomInventorySaved"),
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      setMessage(
        code === "room_inventory_contains_occupied_rooms"
          ? t("roomInventoryReductionBlockedByOccupants")
          : t("roomInventoryCouldNotBeSaved"),
      );
    }
  }

  return (
    <section className="grid gap-3" aria-labelledby="room-inventory-title">
      <div className="grid gap-1">
        <h4 className="text-base font-bold" id="room-inventory-title">
          {t("roomInventory")}
        </h4>
        <p className="text-sm leading-relaxed text-content-muted">
          {t("roomInventoryDescription")}
        </p>
      </div>
      {query.isPending ? (
        <p role="status">{t("loadingRoomInventory")}</p>
      ) : query.isError ? (
        <p role="alert">{t("roomInventoryCouldNotBeLoaded")}</p>
      ) : (
        <RoomInventoryEditor
          inventory={query.data.inventory}
          isSaving={mutations.saveRoomInventory.isPending}
          onSave={(inventory) => void saveInventory(inventory)}
        />
      )}
      {message && (
        <p className={messageStyles()} role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}
