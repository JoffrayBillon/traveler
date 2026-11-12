import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { registerRoomRequestEndpoints } from "./room-requests.endpoints";
import { registerRoomManagementEndpoints } from "./rooming-management.endpoints";

export function registerRoomingMutationEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  registerRoomManagementEndpoints(app, getAuthServices);
  registerRoomRequestEndpoints(app, getAuthServices);
}
