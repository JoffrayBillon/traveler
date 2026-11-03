import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { registerParticipantCreationEndpoints } from "./participant-creation.endpoints";
import { registerTravelerProfileEndpoints } from "./traveler-profile.endpoints";
import { registerTravelerReadEndpoints } from "./traveler-read.endpoints";

export function registerTravelerEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  registerTravelerReadEndpoints(app, getAuthServices);
  registerTravelerProfileEndpoints(app, getAuthServices);
  registerParticipantCreationEndpoints(app, getAuthServices);
}
