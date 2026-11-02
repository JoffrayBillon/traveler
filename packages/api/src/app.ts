import { Hono } from "hono";
import { vercelTicketStorage } from "./adapters/storage/vercel-ticket-storage.adapter";
import { createAuthServicesProvider } from "./composition";
import { createDatabaseProvider } from "./database";
import { registerAgencyRoomingExportEndpoint } from "./endpoints/agency-rooming-export.endpoints";
import { registerAuthEndpoints } from "./endpoints/auth.endpoints";
import { registerIdentityEndpoints } from "./endpoints/identity.endpoints";
import { registerImportEndpoints } from "./endpoints/import.endpoints";
import { registerRoomingMutationEndpoints } from "./endpoints/rooming-mutation.endpoints";
import { registerRoomingReadEndpoints } from "./endpoints/rooming-read.endpoints";
import { registerStaffEndpoints } from "./endpoints/staff.endpoints";
import { registerSystemEndpoints } from "./endpoints/system.endpoints";
import { registerTicketEndpoints } from "./endpoints/ticket.endpoints";
import { registerTicketRetentionEndpoint } from "./endpoints/ticket-retention.endpoint";
import { registerTransportManagementEndpoints } from "./endpoints/transport-management.endpoints";
import { registerTransportReadEndpoints } from "./endpoints/transport-read.endpoints";
import { registerTravelerEndpoints } from "./endpoints/traveler.endpoints";
import { registerTravelerDetailsEndpoints } from "./endpoints/traveler-details.endpoints";
import type { TicketBlobStorage } from "./ports/ticket-storage";

export type { TicketBlobStorage } from "./ports/ticket-storage";

export function createApp(
  getDatabase = createDatabaseProvider(),
  getAuthServices = createAuthServicesProvider(),
  options: {
    ticketStorage?: TicketBlobStorage;
    ticketStorageAvailable?: () => boolean;
    authEnvironment?: NodeJS.ProcessEnv;
  } = {},
) {
  const app = new Hono();
  const authEnvironment = options.authEnvironment ?? process.env;
  const ticketStorage = options.ticketStorage ?? vercelTicketStorage;
  const ticketStorageAvailable =
    options.ticketStorageAvailable ??
    (() => Boolean(process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN));

  registerSystemEndpoints(app, getDatabase);
  registerAuthEndpoints(app, getAuthServices);

  registerIdentityEndpoints(app, getAuthServices);

  registerTravelerEndpoints(app, getAuthServices);
  registerRoomingReadEndpoints(app, getAuthServices);
  registerAgencyRoomingExportEndpoint(app, getAuthServices);
  registerRoomingMutationEndpoints(app, getAuthServices);
  registerTravelerDetailsEndpoints(app, getAuthServices);
  registerTransportReadEndpoints(app, getAuthServices);
  registerTransportManagementEndpoints(app, getAuthServices);

  registerStaffEndpoints(app, getAuthServices, authEnvironment);
  registerImportEndpoints(app, getAuthServices);

  registerTicketEndpoints(
    app,
    getAuthServices,
    ticketStorage,
    ticketStorageAvailable,
  );
  registerTicketRetentionEndpoint(
    app,
    getAuthServices,
    ticketStorage,
    authEnvironment,
  );

  app.notFound((context) => context.json({ error: "not_found" }, 404));

  return app;
}

export type { TravelerDetailsInput } from "./services/traveler-details";
export {
  isValidTravelDateTime,
  synchronizeDepartureTimes,
} from "./services/traveler-details";

const app = createApp();

export default app;
