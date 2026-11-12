import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import type { TransportView } from "./transport.types";

export function useTripTransportQuery(tripId: string) {
  return useQuery({
    queryKey: queryKeys.transport(tripId),
    queryFn: ({ signal }) =>
      apiGet<TransportView>(
        `/api/trips/${encodeURIComponent(tripId)}/transport`,
        signal,
      ),
  });
}
