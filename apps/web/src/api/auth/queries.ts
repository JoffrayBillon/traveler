import { useQuery } from "@tanstack/react-query";
import { ApiError, apiGet, apiPost } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import type { TravelerProfile } from "@traveler/types/profile";
import { useId } from "react";

export function useMagicLinkPreview(token: string) {
  const id = useId();
  return useQuery({
    queryKey: ["auth", "magic-link-preview", id],
    queryFn: () =>
      apiPost<{ firstName: string; lastName: string }>(
        "/api/auth/magic-link/preview",
        { token },
      ),
    enabled: Boolean(token),
    gcTime: 0,
    retry: false,
  });
}

export function useCurrentTravelerQuery() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }) => {
      try {
        return await apiGet<TravelerProfile>("/api/me", signal);
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status))
          return null;
        throw error;
      }
    },
  });
}
