import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@traveler/api/client";

export function useRequestMagicLinkMutation() {
  return useMutation({
    mutationFn: (input: { email: string; callbackURL: string }) =>
      apiPost("/api/auth/sign-in/magic-link", input),
  });
}

export function useSignOutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost("/api/auth/sign-out"),
    onSuccess: () => queryClient.clear(),
  });
}
