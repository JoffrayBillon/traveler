import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, it } from "vitest";
import * as schema from "../schema";
import type { ValidatedRosterRow } from "../source-import/types";
import { createTripsStore } from "../trips";
import { previewValidatedRoster } from "./validated-roster";
import { importValidatedRoster } from "./validated-roster-import";

it("updates roster gender only when an explicit value is supplied", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    const database = drizzle({ client, schema });
    await migrate(database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url),
      ),
    });
    const trip = await createTripsStore(database).create("Roster test");
    const row: ValidatedRosterRow = {
      row: 2,
      reference: "book-1",
      firstName: "Alex",
      lastName: "Example",
      email: "alex@example.test",
      gender: "F",
      activityProfile: "ski",
      paymentStatus: "paid",
      amountPaidMinor: 1000,
      amountDueMinor: 0,
    };
    const withoutGender = { ...row, gender: null };
    const membership = () =>
      database
        .select()
        .from(schema.tripMemberships)
        .where(eq(schema.tripMemberships.tripId, trip.id));
    const registration = () =>
      database
        .select()
        .from(schema.tripRegistrations)
        .where(eq(schema.tripRegistrations.tripId, trip.id));

    await importValidatedRoster(database, trip.id, [row]);
    const preview = await previewValidatedRoster(database, trip.id, [
      withoutGender,
    ]);
    expect(preview.changes).toMatchObject([
      { action: "unchanged", values: [] },
    ]);
    await importValidatedRoster(database, trip.id, [withoutGender]);
    expect(await registration()).toMatchObject([{ gender: "F" }]);
    expect(await membership()).toMatchObject([
      { gender: "F", genderConfirmed: false },
    ]);

    const withCorrection = { ...row, gender: "M" as const };
    const correctionPreview = await previewValidatedRoster(database, trip.id, [
      withCorrection,
    ]);
    expect(correctionPreview.changes).toMatchObject([
      {
        action: "updated",
        values: [{ field: "gender", before: "F", after: "M" }],
      },
    ]);
    await importValidatedRoster(database, trip.id, [withCorrection]);
    expect(await registration()).toMatchObject([{ gender: "M" }]);
    expect(await membership()).toMatchObject([
      { gender: "M", genderConfirmed: false },
    ]);

    await importValidatedRoster(database, trip.id, []);
    expect(await membership()).toEqual([]);
    await importValidatedRoster(database, trip.id, [withoutGender]);
    expect(await membership()).toMatchObject([
      { gender: "M", genderConfirmed: false },
    ]);

    await database
      .update(schema.tripMemberships)
      .set({ genderConfirmed: true })
      .where(eq(schema.tripMemberships.tripId, trip.id));
    await importValidatedRoster(database, trip.id, [withoutGender]);
    await importValidatedRoster(database, trip.id, [row]);
    expect(await membership()).toMatchObject([
      { gender: "M", genderConfirmed: true },
    ]);
  } finally {
    client.close();
  }
});
