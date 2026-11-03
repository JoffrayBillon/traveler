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
    endsOn: text("ends_on"),
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
    isVip: integer("is_vip", { mode: "boolean" }).default(false).notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    gender: text("gender", { enum: ["M", "F"] }),
    genderConfirmed: integer("gender_confirmed", { mode: "boolean" })
      .default(false)
      .notNull(),
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

export const tripRegistrations = sqliteTable(
  "trip_registrations",
  {
    id: text("id").primaryKey().notNull(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status", {
      enum: ["pending", "validated", "cancelled"],
    })
      .default("pending")
      .notNull(),
    sourceEmail: text("source_email").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    sourcePhone: text("source_phone"),
    gender: text("gender", { enum: ["M", "F"] }),
    activityProfile: text("activity_profile", { enum: ["ski", "spa"] }),
    skiDayThree: integer("ski_day_three", { mode: "boolean" }),
    transportMode: text("transport_mode", {
      enum: ["train", "flight", "none"],
    }),
    departureCity: text("departure_city"),
    paymentStatus: text("payment_status", {
      enum: ["paid", "partially_paid", "unpaid"],
    }),
    amountPaidMinor: integer("amount_paid_minor"),
    amountDueMinor: integer("amount_due_minor"),
    lastImportedAt: integer("last_imported_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("trip_registrations_trip_reference_unique").on(
      table.tripId,
      table.reference,
    ),
    index("trip_registrations_trip_status_index").on(
      table.tripId,
      table.status,
    ),
    index("trip_registrations_user_id_index").on(table.userId),
    check(
      "trip_registrations_status_valid",
      sql`${table.status} IN ('pending', 'validated', 'cancelled')`,
    ),
    check(
      "trip_registrations_payment_status_valid",
      sql`${table.paymentStatus} IS NULL OR ${table.paymentStatus} IN ('paid', 'partially_paid', 'unpaid')`,
    ),
    check(
      "trip_registrations_activity_valid",
      sql`${table.activityProfile} IS NULL OR ${table.activityProfile} IN ('ski', 'spa')`,
    ),
    check(
      "trip_registrations_gender_valid",
      sql`${table.gender} IS NULL OR ${table.gender} IN ('M', 'F')`,
    ),
  ],
);

export const tripImportPreviews = sqliteTable(
  "trip_import_previews",
  {
    id: text("id").primaryKey().notNull(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceType: text("source_type", {
      enum: [
        "validated_roster",
        "detailed_orders",
        "companions_vips",
        "agency_rooming",
      ],
    }).notNull(),
    contentHash: text("content_hash").notNull(),
    baseSnapshotHash: text("base_snapshot_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("trip_import_previews_expiry_index").on(table.expiresAt),
    check(
      "trip_import_previews_source_type_valid",
      sql`${table.sourceType} IN ('validated_roster', 'detailed_orders', 'companions_vips', 'agency_rooming')`,
    ),
  ],
);

export const travelerProfiles = sqliteTable(
  "traveler_profiles",
  {
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    dietaryRequirements: text("dietary_requirements"),
    allergens: text("allergens"),
    emergencyContactFirstName: text("emergency_contact_first_name"),
    emergencyContactLastName: text("emergency_contact_last_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("traveler_profiles_trip_user_unique").on(
      table.tripId,
      table.userId,
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
    transportChoice: text("transport_choice", {
      enum: ["group", "none", "unconfirmed"],
    }),
    carpoolRole: text("carpool_role", {
      enum: ["none", "driver", "passenger", "undecided"],
    })
      .default("none")
      .notNull(),
    carpoolDriverUserId: text("carpool_driver_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
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
    check(
      "traveler_details_carpool_driver_consistent",
      sql`(${table.carpoolRole} = 'passenger' AND ${table.carpoolDriverUserId} IS NOT NULL AND ${table.carpoolDriverUserId} <> ${table.userId}) OR (${table.carpoolRole} <> 'passenger' AND ${table.carpoolDriverUserId} IS NULL)`,
    ),
    check(
      "traveler_details_carpool_role_valid",
      sql`${table.carpoolRole} IN ('none', 'driver', 'passenger', 'undecided')`,
    ),
    check(
      "traveler_details_transport_choice_valid",
      sql`${table.transportChoice} IS NULL OR ${table.transportChoice} IN ('group', 'none', 'unconfirmed')`,
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
    isLocked: integer("is_locked", { mode: "boolean" })
      .default(false)
      .notNull(),
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

export const roomInventory = sqliteTable(
  "room_inventory",
  {
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    capacity: integer("capacity").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    uniqueIndex("room_inventory_trip_capacity_unique").on(
      table.tripId,
      table.capacity,
    ),
    check(
      "room_inventory_capacity_valid",
      sql`${table.capacity} BETWEEN 1 AND 12`,
    ),
    check(
      "room_inventory_quantity_valid",
      sql`${table.quantity} BETWEEN 0 AND 200`,
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
      enum: ["pending", "applied", "rejected", "cancelled", "expired", "stale"],
    })
      .default("pending")
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("room_change_requests_trip_status_index").on(
      table.tripId,
      table.status,
    ),
    check(
      "room_change_requests_status_valid",
      sql`${table.status} IN ('pending', 'applied', 'rejected', 'cancelled', 'expired', 'stale')`,
    ),
  ],
);

export const roomAssignmentHistory = sqliteTable(
  "room_assignment_history",
  {
    id: text("id").primaryKey().notNull(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name").notNull(),
    actionType: text("action_type", {
      enum: [
        "organizer_move",
        "plan_generation",
        "plan_reset",
        "roster_import",
      ],
    }).notNull(),
    changesJson: text("changes_json").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("room_assignment_history_trip_created_index").on(
      table.tripId,
      table.createdAt,
    ),
    check(
      "room_assignment_history_action_type_valid",
      sql`${table.actionType} IN ('organizer_move', 'plan_generation', 'plan_reset', 'roster_import')`,
    ),
  ],
);

export const transportGroups = sqliteTable(
  "transport_groups",
  {
    id: text("id").primaryKey().notNull(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceCity: text("source_city").notNull(),
    normalizedCity: text("normalized_city").notNull(),
    isDraft: integer("is_draft", { mode: "boolean" }).default(true).notNull(),
    outboundMeetingAt: text("outbound_meeting_at"),
    outboundMeetingPlace: text("outbound_meeting_place"),
    returnMeetingAt: text("return_meeting_at"),
    returnMeetingPlace: text("return_meeting_place"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("transport_groups_trip_id_unique").on(table.tripId, table.id),
    index("transport_groups_trip_city_index").on(
      table.tripId,
      table.normalizedCity,
    ),
    check(
      "transport_groups_name_not_blank",
      sql`length(trim(${table.name})) > 0`,
    ),
    check(
      "transport_groups_city_not_blank",
      sql`length(trim(${table.sourceCity})) > 0 AND length(trim(${table.normalizedCity})) > 0`,
    ),
  ],
);

export const transportGroupSegments = sqliteTable(
  "transport_group_segments",
  {
    id: text("id").primaryKey().notNull(),
    tripId: text("trip_id").notNull(),
    groupId: text("group_id").notNull(),
    direction: text("direction", { enum: ["outbound", "return"] }).notNull(),
    position: integer("position").notNull(),
    mode: text("mode", { enum: ["train", "flight"] }).notNull(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    departureAt: text("departure_at"),
    arrivalAt: text("arrival_at"),
    serviceReference: text("service_reference"),
  },
  (table) => [
    uniqueIndex("transport_group_segments_order_unique").on(
      table.tripId,
      table.groupId,
      table.direction,
      table.position,
    ),
    foreignKey({
      name: "transport_group_segments_group_trip_fk",
      columns: [table.tripId, table.groupId],
      foreignColumns: [transportGroups.tripId, transportGroups.id],
    }).onDelete("cascade"),
    check(
      "transport_group_segments_position_nonnegative",
      sql`${table.position} >= 0`,
    ),
    check(
      "transport_group_segments_locations_not_blank",
      sql`length(trim(${table.origin})) > 0 AND length(trim(${table.destination})) > 0`,
    ),
  ],
);

export const transportGroupAssignments = sqliteTable(
  "transport_group_assignments",
  {
    tripId: text("trip_id").notNull(),
    groupId: text("group_id").notNull(),
    userId: text("user_id").notNull(),
    assignedBy: text("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedAt: integer("assigned_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("transport_group_assignments_trip_user_unique").on(
      table.tripId,
      table.userId,
    ),
    foreignKey({
      name: "transport_group_assignments_group_trip_fk",
      columns: [table.tripId, table.groupId],
      foreignColumns: [transportGroups.tripId, transportGroups.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "transport_group_assignments_member_trip_fk",
      columns: [table.tripId, table.userId],
      foreignColumns: [tripMemberships.tripId, tripMemberships.userId],
    }).onDelete("cascade"),
  ],
);

export type Trip = typeof trips.$inferSelect;
