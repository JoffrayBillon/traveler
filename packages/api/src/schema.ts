import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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

export const users = sqliteTable(
  "user",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("emailVerified", { mode: "boolean" })
      .default(false)
      .notNull(),
    image: text("image"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const sessions = sqliteTable(
  "session",
  {
    id: text("id").primaryKey().notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("session_token_unique").on(table.token),
    index("session_user_id_index").on(table.userId),
  ],
);

export const accounts = sqliteTable(
  "account",
  {
    id: text("id").primaryKey().notNull(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("account_user_id_index").on(table.userId)],
);

export const verifications = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey().notNull(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
  },
  (table) => [index("verification_identifier_index").on(table.identifier)],
);

export const rateLimits = sqliteTable(
  "rateLimit",
  {
    id: text("id").primaryKey().notNull(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: integer("lastRequest").notNull(),
  },
  (table) => [uniqueIndex("rateLimit_key_unique").on(table.key)],
);

export const tripMemberships = sqliteTable(
  "trip_memberships",
  {
    id: text("id").primaryKey().notNull(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["traveler", "companion", "manager"],
    }).notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    gender: text("gender", { enum: ["M", "F"] }),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("trip_memberships_trip_user_unique").on(
      table.tripId,
      table.userId,
    ),
    index("trip_memberships_user_id_index").on(table.userId),
    check(
      "trip_memberships_role_valid",
      sql`${table.role} IN ('traveler', 'companion', 'manager')`,
    ),
    check(
      "trip_memberships_gender_valid",
      sql`${table.gender} IS NULL OR ${table.gender} IN ('M', 'F')`,
    ),
  ],
);

export const travelerDetails = sqliteTable(
  "traveler_details",
  {
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityProfile: text("activity_profile", { enum: ["ski", "spa"] }),
    skiDayThree: integer("ski_day_three", { mode: "boolean" })
      .default(false)
      .notNull(),
    transportMode: text("transport_mode", {
      enum: ["train", "flight", "none"],
    }),
    departureCity: text("departure_city"),
    outboundDateTime: text("outbound_date_time"),
    outboundTimezone: text("outbound_timezone"),
    outboundMeetingTime: text("outbound_meeting_time"),
    outboundDepartureTime: text("outbound_departure_time"),
    outboundLocation: text("outbound_location"),
    outboundReference: text("outbound_reference"),
    outboundSeat: text("outbound_seat"),
    returnDateTime: text("return_date_time"),
    returnTimezone: text("return_timezone"),
    returnMeetingTime: text("return_meeting_time"),
    returnDepartureTime: text("return_departure_time"),
    returnLocation: text("return_location"),
    returnReference: text("return_reference"),
    returnSeat: text("return_seat"),
    carpoolPreference: integer("carpool_preference", { mode: "boolean" }),
    parkingPreference: integer("parking_preference", { mode: "boolean" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("traveler_details_trip_user_unique").on(
      table.tripId,
      table.userId,
    ),
    check(
      "traveler_details_ski_day_requires_ski",
      sql`${table.skiDayThree} = 0 OR ${table.activityProfile} = 'ski'`,
    ),
    check(
      "traveler_details_transport_preferences_require_none",
      sql`(${table.transportMode} = 'none') OR (${table.carpoolPreference} IS NULL AND ${table.parkingPreference} IS NULL)`,
    ),
    check(
      "traveler_details_parking_requires_carpool",
      sql`${table.parkingPreference} IS NULL OR ${table.parkingPreference} = 0 OR ${table.carpoolPreference} = 1`,
    ),
  ],
);

export const transportTickets = sqliteTable(
  "transport_tickets",
  {
    id: text("id").primaryKey().notNull(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["outbound", "return", "other"] }).notNull(),
    blobPath: text("blob_path").notNull(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("transport_tickets_trip_user_index").on(table.tripId, table.userId),
  ],
);

export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey().notNull(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull(),
    genderPolicy: text("gender_policy", {
      enum: ["single_gender", "mixed", "unset"],
    })
      .default("unset")
      .notNull(),
    compositionVersion: integer("composition_version").default(1).notNull(),
  },
  (table) => [
    uniqueIndex("rooms_trip_name_unique").on(table.tripId, table.name),
    uniqueIndex("rooms_trip_id_unique").on(table.tripId, table.id),
    check("rooms_capacity_positive", sql`${table.capacity} > 0`),
    check(
      "rooms_gender_policy_valid",
      sql`${table.genderPolicy} IN ('single_gender', 'mixed', 'unset')`,
    ),
  ],
);

export const roomAssignments = sqliteTable(
  "room_assignments",
  {
    id: text("id").primaryKey().notNull(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedAt: integer("assigned_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("room_assignments_trip_user_unique").on(
      table.tripId,
      table.userId,
    ),
    uniqueIndex("room_assignments_trip_room_user_unique").on(
      table.tripId,
      table.roomId,
      table.userId,
    ),
    index("room_assignments_room_index").on(table.tripId, table.roomId),
    foreignKey({
      name: "room_assignments_room_trip_fk",
      columns: [table.tripId, table.roomId],
      foreignColumns: [rooms.tripId, rooms.id],
    }).onDelete("cascade"),
  ],
);

export const roomChangeRequests = sqliteTable(
  "room_change_requests",
  {
    id: text("id").primaryKey().notNull(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    requesterUserId: text("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    changesJson: text("changes_json").notNull(),
    requiredConsentsJson: text("required_consents_json").notNull(),
    approvedConsentsJson: text("approved_consents_json").notNull(),
    status: text("status", {
      enum: ["pending", "applied", "rejected", "cancelled", "stale"],
    })
      .default("pending")
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("room_change_requests_trip_status_index").on(
      table.tripId,
      table.status,
    ),
    check(
      "room_change_requests_status_valid",
      sql`${table.status} IN ('pending', 'applied', 'rejected', 'cancelled', 'stale')`,
    ),
  ],
);

export type Trip = typeof trips.$inferSelect;
