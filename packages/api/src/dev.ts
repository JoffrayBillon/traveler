import { serve } from "@hono/node-server";
import app from "./app";

serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 3001 }, (info) => {
  console.info(`Traveler API listening on http://127.0.0.1:${info.port}`);
});
