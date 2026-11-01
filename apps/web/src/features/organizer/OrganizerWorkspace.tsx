import { eyebrowStyles, PageContainer, Stack } from "@traveler/components/ui";
import { ArrowLeft, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { StaffTools } from "./StaffTools";

export function OrganizerWorkspace({
  tripId,
  tripName: initialTripName,
  role,
}: {
  tripId: string;
  tripName: string;
  role: "companion" | "manager";
}) {
  const { t } = useTranslation();
  return (
    <PageContainer spacing="regular" aria-labelledby="organizer-title">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-content-muted no-underline hover:text-accent"
        to={`/trips/${encodeURIComponent(tripId)}`}
      >
        <ArrowLeft aria-hidden="true" size={17} /> {t("backToTrip")}
      </Link>
      <div className="flex items-center justify-start gap-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-card bg-surface-muted text-accent">
          <Settings2 aria-hidden="true" size={22} />
        </span>
        <div className="grid gap-1">
          <p className={eyebrowStyles()}>{initialTripName}</p>
          <h1
            className="text-[clamp(2rem,4vw,3.4rem)] tracking-[-0.06em]"
            id="organizer-title"
            data-route-heading
            tabIndex={-1}
          >
            {t("organizerSpace")}
          </h1>
          <p className="text-content-muted">
            {t("toolsSharedByTheTripOrganizers")}
          </p>
        </div>
      </div>
      <Stack gap="lg">
        <StaffTools tripId={tripId} isManager={role === "manager"} />
      </Stack>
    </PageContainer>
  );
}
