import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import type { StaffTraveler } from "./participant.types";

export function useParticipantDirectoryQuery(tripId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.participantDirectory(tripId),
    enabled,
    queryFn: async ({ signal }) =>
      (
        await apiGet<{ travelers: StaffTraveler[] }>(
          `/api/trips/${encodeURIComponent(tripId)}/travelers`,
          signal,
        )
      ).travelers,
  });
}
