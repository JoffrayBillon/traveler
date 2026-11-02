import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { registerRoomRequestConsentEndpoint } from "./room-request-consent.endpoint";
import { registerRoomRequestCreateEndpoint } from "./room-request-create.endpoint";
import { registerRoomRequestReadEndpoint } from "./room-request-read.endpoint";
import { registerRoomRequestWithdrawEndpoint } from "./room-request-withdraw.endpoint";

export function registerRoomRequestEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  registerRoomRequestCreateEndpoint(app, getAuthServices);
  registerRoomRequestReadEndpoint(app, getAuthServices);
  registerRoomRequestConsentEndpoint(app, getAuthServices);
  registerRoomRequestWithdrawEndpoint(app, getAuthServices);
}
