import type { RoomSummary } from "@traveler/api/rooming/rooming.types";
import { useTranslation } from "react-i18next";

export function RoomCompositionBadge({ room }: { room: RoomSummary }) {
  const { t } = useTranslation();
  const { composition } = room;
  const label =
    composition === "mixed"
      ? t("mixedRoomCode")
      : composition === "male"
        ? t("maleRoomCode")
        : composition === "female"
          ? t("femaleRoomCode")
          : t("roomCompositionNotSet");

  return (
    <span
      role="img"
      aria-label={label}
      className={
        composition === "mixed"
          ? "inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-warning bg-[color-mix(in_srgb,var(--theme-color-warning),transparent_82%)] px-3 text-sm font-extrabold text-warning shadow-sm ring-2 ring-[color-mix(in_srgb,var(--theme-color-warning),transparent_84%)]"
          : "inline-flex size-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--theme-color-success),transparent_92%)] text-xs font-semibold text-content-subtle"
      }
    >
      {composition === "mixed" ? (
        <>
          <span aria-hidden="true">M</span>
          <span>{t("mixedRoom")}</span>
        </>
      ) : composition === "male" ? (
        "H"
      ) : composition === "female" ? (
        "F"
      ) : (
        "—"
      )}
    </span>
  );
}
