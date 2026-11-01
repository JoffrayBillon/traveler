import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import type { TravelerTripData } from "./trip.types";

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
