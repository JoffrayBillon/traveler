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
    queryClient.invalidateQueries({ queryKey: queryKeys.transport(tripId) }),
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
      isVip,
      isManager,
    }: SaveParticipantInput) => {
      const participantPath = `/api/trips/${encodeURIComponent(tripId)}/participants/${encodeURIComponent(participant.userId)}`;
      await apiRequest(`${participantPath}/admin-profile`, {
        method: "PUT",
        body: JSON.stringify({
          profile,
          details,
          isVip,
          ...(isManager ? { email, role } : {}),
        }),
      });
    },
    // Refresh related views after a save attempt, including transactional errors.
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
