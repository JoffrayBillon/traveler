import type { AuthServices } from "../../auth";

export function getSession(
  services: AuthServices,
  headers: Headers,
): ReturnType<typeof services.auth.api.getSession> {
  return services.auth.api.getSession({ headers });
}
