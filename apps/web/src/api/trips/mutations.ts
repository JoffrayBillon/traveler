import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import type { TravelerProfile } from "@traveler/types/profile";
import type { TravelerTripData } from "./trip.types";

export type CarpoolPreferencesInput = {
  carpoolPreference: boolean;
  parkingPreference: boolean;
};

export function useUpdateTripNameMutation(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiRequest(`/api/trips/${encodeURIComponent(tripId)}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (_result, name) => {
      queryClient.setQueryData<TravelerTripData>(
        queryKeys.traveler(tripId),
        (current) =>
          current ? { ...current, trip: { ...current.trip, name } } : current,
      );
      queryClient.setQueryData<TravelerProfile | null>(
        queryKeys.me,
        (current) =>
          current
            ? {
                ...current,
                trips: current.trips.map((trip) =>
                  trip.tripId === tripId ? { ...trip, tripName: name } : trip,
                ),
              }
            : current,
      );
    },
  });
}

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
      queryClient.setQueryData<TravelerTripData>(
        queryKeys.traveler(tripId),
        (current) =>
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
