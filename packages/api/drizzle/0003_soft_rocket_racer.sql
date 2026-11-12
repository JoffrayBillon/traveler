CREATE TABLE `room_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`assigned_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`,`room_id`) REFERENCES `rooms`(`trip_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_assignments_trip_user_unique` ON `room_assignments` (`trip_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `room_assignments_trip_room_user_unique` ON `room_assignments` (`trip_id`,`room_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `room_assignments_room_index` ON `room_assignments` (`trip_id`,`room_id`);--> statement-breakpoint
CREATE TABLE `room_change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`requester_user_id` text NOT NULL,
	`changes_json` text NOT NULL,
	`required_consents_json` text NOT NULL,
	`approved_consents_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "room_change_requests_status_valid" CHECK("room_change_requests"."status" IN ('pending', 'applied', 'rejected', 'cancelled', 'stale'))
);
--> statement-breakpoint
CREATE INDEX `room_change_requests_trip_status_index` ON `room_change_requests` (`trip_id`,`status`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`name` text NOT NULL,
	`capacity` integer NOT NULL,
	`gender_policy` text DEFAULT 'unset' NOT NULL,
	`composition_version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rooms_capacity_positive" CHECK("rooms"."capacity" > 0),
	CONSTRAINT "rooms_gender_policy_valid" CHECK("rooms"."gender_policy" IN ('single_gender', 'mixed', 'unset'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_trip_name_unique` ON `rooms` (`trip_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_trip_id_unique` ON `rooms` (`trip_id`,`id`);--> statement-breakpoint
CREATE TABLE `transport_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`blob_path` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `transport_tickets_trip_user_index` ON `transport_tickets` (`trip_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `traveler_details` (
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`activity_profile` text,
	`ski_day_three` integer DEFAULT false NOT NULL,
	`transport_mode` text,
	`outbound_date_time` text,
	`outbound_timezone` text,
	`outbound_location` text,
	`outbound_reference` text,
	`outbound_seat` text,
	`return_date_time` text,
	`return_timezone` text,
	`return_location` text,
	`return_reference` text,
	`return_seat` text,
	`carpool_preference` integer,
	`parking_preference` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "traveler_details_ski_day_requires_ski" CHECK("traveler_details"."ski_day_three" = 0 OR "traveler_details"."activity_profile" = 'ski'),
	CONSTRAINT "traveler_details_transport_preferences_require_none" CHECK(("traveler_details"."transport_mode" = 'none') OR ("traveler_details"."carpool_preference" IS NULL AND "traveler_details"."parking_preference" IS NULL)),
	CONSTRAINT "traveler_details_parking_requires_carpool" CHECK("traveler_details"."parking_preference" IS NULL OR "traveler_details"."parking_preference" = 0 OR "traveler_details"."carpool_preference" = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `traveler_details_trip_user_unique` ON `traveler_details` (`trip_id`,`user_id`);