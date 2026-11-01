import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../shared/api/client";
import { queryKeys } from "../../shared/query/query-keys";

export type CarpoolPreferencesInput = {
  carpoolPreference: boolean;
  parkingPreference: boolean;
};

export function useSaveCarpoolPreferencesMutation(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CarpoolPreferencesInput) =>
      apiRequest(
        `/api/trips/${encodeURIComponent(tripId)}/carpool-preferences`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: (_result, input) => {
      queryClient.setQueryData<
        import("./traveler-trip.types").TravelerTripData
      >(queryKeys.traveler(tripId), (current) =>
        current?.details
          ? {
              ...current,
              details: {
                ...current.details,
                carpoolPreference: input.carpoolPreference,
                parkingPreference: input.parkingPreference,
              },
            }
          : current,
      );
    },
  });
}
