import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, it } from "vitest";
import { getTripTransportView } from "./datamodel/transport.repository";
import * as schema from "./schema";
import { saveTransportGroupService } from "./services/transport/transport-service";

it("stores bus and shuttle transfers with optional instructions in journey order", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    const database = drizzle({ client, schema });
    await migrate(database, {
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
    });
    const tripId = "transfer-test";
    await database
      .insert(schema.trips)
      .values({ id: tripId, name: "Transfer test" });
    const segment = {
      departureAt: null,
      arrivalAt: null,
      serviceReference: null,
    };
    const group = {
      name: "Ski Paris",
      sourceCity: "Paris",
      outboundMeetingAt: null,
      outboundMeetingPlace: null,
      returnMeetingAt: null,
      returnMeetingPlace: null,
      segments: [
        {
          ...segment,
          mode: "train",
          direction: "outbound",
          origin: "Paris",
          destination: "Moûtiers",
        },
        {
          ...segment,
          mode: "bus",
          direction: "outbound",
          origin: "Moûtiers",
          destination: "Hôtel",
          instructions: "  Rendez-vous à la sortie nord.  ",
        },
        {
          ...segment,
          mode: "shuttle",
          direction: "return",
          origin: "Hôtel",
          destination: "Moûtiers",
        },
      ],
    };
    const result = await saveTransportGroupService(database, tripId, group);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("The transfer group was rejected.");
    const view = await getTripTransportView(database, tripId, "staff", true);
    expect(view.groups).toMatchObject([
      {
        segments: [
          { position: 0, mode: "train", instructions: null },
          {
            position: 1,
            mode: "bus",
            instructions: "Rendez-vous à la sortie nord.",
          },
          { position: 2, mode: "shuttle", instructions: null },
        ],
      },
    ]);
    const [saved] = view.groups;
    if (!saved) throw new Error("The saved group is missing.");
    const edited = await saveTransportGroupService(
      database,
      tripId,
      {
        ...group,
        segments: saved.segments.map(
          ({ instructions: _instructions, ...savedSegment }) => savedSegment,
        ),
      },
      saved.id,
    );
    expect(edited.ok).toBe(true);
    const updated = await getTripTransportView(database, tripId, "staff", true);
    expect(updated.groups[0]?.segments[1]?.instructions).toBe(
      "Rendez-vous à la sortie nord.",
    );
  } finally {
    await client.close();
  }
});
