import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../shared/api/client";
import { queryKeys } from "../../shared/query/query-keys";
import type { StaffTraveler } from "./types";

export function useParticipantDirectoryQuery(tripId: string) {
  return useQuery({
    queryKey: queryKeys.participantDirectory(tripId),
    queryFn: async ({ signal }) =>
      (
        await apiGet<{ travelers: StaffTraveler[] }>(
          `/api/trips/${encodeURIComponent(tripId)}/travelers`,
          signal,
        )
      ).travelers,
  });
}
