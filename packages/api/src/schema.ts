import { sql } from "drizzle-orm";
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const trips = sqliteTable(
  "trips",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
  },
  (table) => [
    check("trips_name_not_blank", sql`length(trim(${table.name})) > 0`),
  ],
);

export type Trip = typeof trips.$inferSelect;
