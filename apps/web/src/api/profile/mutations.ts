import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import { applyProfileValues } from "@traveler/api/trips/model";
import type { TravelerTripData } from "@traveler/api/trips/trip.types";
import type { TravelerProfileValues } from "./profile.types";

export function useSaveTravelerProfileMutation(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: TravelerProfileValues) =>
      apiRequest(`/api/trips/${encodeURIComponent(tripId)}/profile`, {
        method: "PUT",
        body: JSON.stringify(values),
      }),
    onSuccess: async (_result, values) => {
      queryClient.setQueryData<TravelerTripData>(
        queryKeys.traveler(tripId),
        (current) => (current ? applyProfileValues(current, values) : current),
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.rooming(tripId),
      });
    },
  });
}
