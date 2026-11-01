import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../shared/api/client";
import { queryKeys } from "../../shared/query/query-keys";
import type { TravelerTripData } from "../trips/traveler-trip.types";
import { applyProfileValues } from "../trips/traveler-trip.utils";
import type { TravelerProfileValues } from "./TravelerProfileForm";

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
