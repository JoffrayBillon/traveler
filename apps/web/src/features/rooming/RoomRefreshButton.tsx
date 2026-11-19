import { Button } from "@traveler/components/ui";
import { RefreshCw } from "lucide-react";
import { Tooltip, TooltipTrigger } from "react-aria-components";
import { useTranslation } from "react-i18next";

function formatElapsedTime(lastUpdatedAt: number, locale: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (seconds < 60) return format.format(-seconds, "second");
  if (seconds < 3600) return format.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400)
    return format.format(-Math.floor(seconds / 3600), "hour");
  return format.format(-Math.floor(seconds / 86400), "day");
}

export function RoomRefreshButton({
  lastUpdatedAt,
  isRefreshing,
  onRefresh,
}: {
  lastUpdatedAt: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <TooltipTrigger>
      <Button
        appearance="quiet"
        className="size-11 shrink-0 p-0"
        aria-label={t("refreshRoomPlan")}
        isPending={isRefreshing}
        onPress={onRefresh}
      >
        <RefreshCw
          aria-hidden="true"
          size={18}
          className={isRefreshing ? "motion-safe:animate-spin" : undefined}
        />
      </Button>
      <Tooltip
        placement="bottom"
        className="z-50 max-w-56 rounded-control border border-border bg-surface-raised px-3 py-2 text-center text-xs text-content shadow-card"
      >
        {() =>
          lastUpdatedAt
            ? t("roomPlanLastUpdated", {
                time: formatElapsedTime(lastUpdatedAt, i18n.language),
              })
            : t("roomPlanNotYetUpdated")
        }
      </Tooltip>
    </TooltipTrigger>
  );
}
