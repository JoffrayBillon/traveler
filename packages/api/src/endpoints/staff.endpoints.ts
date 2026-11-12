import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { registerStaffMutationEndpoints } from "./staff-mutation.endpoints";
import { registerStaffReadEndpoints } from "./staff-read.endpoints";

export function registerStaffEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
  authEnvironment: NodeJS.ProcessEnv,
) {
  registerStaffReadEndpoints(app, getAuthServices);
  registerStaffMutationEndpoints(app, getAuthServices, authEnvironment);
}
