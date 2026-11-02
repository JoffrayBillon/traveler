import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiRequest } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import type { SaveParticipantInput } from "./participant-form.types";

async function invalidateParticipants(
  queryClient: ReturnType<typeof useQueryClient>,
  tripId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.participantDirectory(tripId),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.rooming(tripId) }),
  ]);
}

export function useCreateParticipantMutation(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      firstName: string;
      lastName: string;
      email: string;
    }) =>
      apiPost(`/api/trips/${encodeURIComponent(tripId)}/participants`, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.participantDirectory(tripId),
      }),
  });
}

export function useSaveParticipantMutation(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      participant,
      profile,
      details,
      email,
      role,
      isManager,
    }: SaveParticipantInput) => {
      const participantPath = `/api/trips/${encodeURIComponent(tripId)}/participants/${encodeURIComponent(participant.userId)}`;
      await apiRequest(`${participantPath}/profile`, {
        method: "PUT",
        body: JSON.stringify(profile),
      });

      await apiRequest(`${participantPath}/activity`, {
        method: "PATCH",
        body: JSON.stringify(details),
      });
      if (isManager && role !== participant.role) {
        await apiRequest(`${participantPath}/role`, {
          method: "PUT",
          body: JSON.stringify({ role }),
        });
      }
      if (isManager && email.trim().toLowerCase() !== participant.email) {
        await apiRequest(`${participantPath}/email`, {
          method: "PUT",
          body: JSON.stringify({ email }),
        });
      }
    },
    // The save spans several HTTP endpoints and can partially complete before
    // one of them fails, so refresh the directory even after a rejected save.
    onSettled: () => invalidateParticipants(queryClient, tripId),
  });
}

export function useCopyParticipantLinkMutation(tripId: string) {
  return useMutation({
    mutationFn: async (participantId: string) => {
      const result = await apiPost<{ link: string }>(
        `/api/trips/${encodeURIComponent(tripId)}/participants/${encodeURIComponent(participantId)}/login-link`,
      );
      return result.link;
    },
    retry: false,
  });
}
