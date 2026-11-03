import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { registerStaffAccountEndpoints } from "./staff-account.endpoints";
import { registerStaffParticipantMutationEndpoints } from "./staff-participant-mutation.endpoints";

export function registerStaffMutationEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
  authEnvironment: NodeJS.ProcessEnv,
) {
  registerStaffParticipantMutationEndpoints(app, getAuthServices);
  registerStaffAccountEndpoints(app, getAuthServices, authEnvironment);
}
