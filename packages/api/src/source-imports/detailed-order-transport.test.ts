import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, it } from "vitest";
import { setParticipantTransport } from "../datamodel/transport.repository";
import * as schema from "../schema";
import { createTripsStore } from "../trips";
import { importDetailedOrders, previewDetailedOrders } from "./detailed-orders";
import { importValidatedRoster } from "./validated-roster-import";

it.each([true, false])(
  "applies and remembers an explicit group mapping (roster first: %s)",
  async (rosterFirst) => {
    const client = createClient({ url: "file::memory:" });
    try {
      const database = drizzle({ client, schema });
      await migrate(database, {
        migrationsFolder: fileURLToPath(
          new URL("../../drizzle", import.meta.url),
        ),
      });
      const trip = await createTripsStore(database).create("Import test");
      const now = new Date();
      await database.insert(schema.users).values({
        id: "actor",
        name: "Organizer",
        email: "actor@example.test",
        createdAt: now,
        updatedAt: now,
      });
      await database.insert(schema.transportGroups).values({
        id: "existing",
        tripId: trip.id,
        name: "Gare du Nord",
        sourceCity: "Île-de-France",
        normalizedCity: "île-de-france",
        createdAt: now,
        updatedAt: now,
      });
      const roster = {
        row: 2,
        reference: "123",
        firstName: "Alex",
        lastName: "Example",
        email: "alex@example.test",
        gender: null,
        activityProfile: "ski",
        paymentStatus: "paid",
        amountPaidMinor: 1000,
        amountDueMinor: 0,
      } as const;
      const details = {
        ...roster,
        phone: null,
        bookingStatus: "validated",
        skiDayThree: false,
        transportMode: "train",
        departureCity: "PARIS",
      } as const;
      const importRoster = () =>
        importValidatedRoster(database, trip.id, [roster], undefined, "actor");
      if (rosterFirst) await importRoster();

      const preview = await previewDetailedOrders(database, trip.id, [details]);
      expect(preview.transportRows[0]).toMatchObject({
        action: "create_draft",
        candidates: [{ id: "existing", name: "Gare du Nord" }],
      });
      await expect(
        importDetailedOrders(
          database,
          trip.id,
          [details],
          { paris: "unknown" },
          "actor",
        ),
      ).rejects.toThrow();
      await importDetailedOrders(
        database,
        trip.id,
        [details],
        { paris: "existing" },
        "actor",
      );
      if (!rosterFirst) {
        expect(
          await database.select().from(schema.transportGroupAssignments),
        ).toHaveLength(0);
        await importRoster();
      }
      const assignments = await database
        .select()
        .from(schema.transportGroupAssignments);
      expect(assignments).toEqual([
        expect.objectContaining({ groupId: "existing", assignedBy: "actor" }),
      ]);
      expect(await database.select().from(schema.travelerDetails)).toEqual([
        expect.objectContaining({ transportChoice: "group" }),
      ]);
      expect(
        (await previewDetailedOrders(database, trip.id, [details]))
          .transportRows[0],
      ).toMatchObject({
        action: "matched",
        groupId: "existing",
      });
      await importDetailedOrders(database, trip.id, [details], {}, "actor");
      expect(await database.select().from(schema.transportGroups)).toHaveLength(
        1,
      );
      expect(
        await database.select().from(schema.transportGroupAssignments),
      ).toHaveLength(1);
      const assignedUserId = assignments[0]?.userId;
      if (!assignedUserId) throw new Error("Missing test assignment");
      await setParticipantTransport(
        database,
        trip.id,
        assignedUserId,
        "none",
        null,
        "actor",
      );
      await importDetailedOrders(database, trip.id, [details], {}, "actor");
      expect(
        await database.select().from(schema.transportGroupAssignments),
      ).toHaveLength(0);
      expect(await database.select().from(schema.travelerDetails)).toEqual([
        expect.objectContaining({ transportChoice: "none" }),
      ]);
      await client.execute({
        sql: "delete from transport_groups where id = ?",
        args: ["existing"],
      });
      expect(await database.select().from(schema.tripRegistrations)).toEqual([
        expect.objectContaining({ importedTransportGroupId: null }),
      ]);
    } finally {
      client.close();
    }
  },
);
