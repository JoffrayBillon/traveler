import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../shared/api/client";
import { queryKeys } from "../../shared/query/query-keys";
import type { TravelerTripData } from "./traveler-trip.types";

export function useTravelerTripQuery(tripId: string) {
  return useQuery({
    queryKey: queryKeys.traveler(tripId),
    queryFn: ({ signal }) =>
      apiGet<TravelerTripData>(
        `/api/trips/${encodeURIComponent(tripId)}/traveler`,
        signal,
      ),
  });
}
