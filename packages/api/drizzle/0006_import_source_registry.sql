CREATE TABLE `traveler_profiles` (
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`dietary_requirements` text,
	`allergens` text,
	`emergency_contact_first_name` text,
	`emergency_contact_last_name` text,
	`emergency_contact_phone` text,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `traveler_profiles_trip_user_unique` ON `traveler_profiles` (`trip_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `trip_import_previews` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`source_type` text NOT NULL,
	`content_hash` text NOT NULL,
	`base_snapshot_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trip_import_previews_source_type_valid" CHECK("trip_import_previews"."source_type" IN ('validated_roster', 'detailed_orders', 'companions_vips', 'agency_rooming'))
);
--> statement-breakpoint
CREATE INDEX `trip_import_previews_expiry_index` ON `trip_import_previews` (`expires_at`);--> statement-breakpoint
CREATE TABLE `trip_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`reference` text NOT NULL,
	`user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`source_email` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`source_phone` text,
	`gender` text,
	`activity_profile` text,
	`ski_day_three` integer,
	`transport_mode` text,
	`departure_city` text,
	`payment_status` text,
	`amount_paid_minor` integer,
	`amount_due_minor` integer,
	`last_imported_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "trip_registrations_status_valid" CHECK("trip_registrations"."status" IN ('pending', 'validated', 'cancelled')),
	CONSTRAINT "trip_registrations_payment_status_valid" CHECK("trip_registrations"."payment_status" IS NULL OR "trip_registrations"."payment_status" IN ('paid', 'partially_paid', 'unpaid')),
	CONSTRAINT "trip_registrations_activity_valid" CHECK("trip_registrations"."activity_profile" IS NULL OR "trip_registrations"."activity_profile" IN ('ski', 'spa')),
	CONSTRAINT "trip_registrations_gender_valid" CHECK("trip_registrations"."gender" IS NULL OR "trip_registrations"."gender" IN ('M', 'F'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_registrations_trip_reference_unique` ON `trip_registrations` (`trip_id`,`reference`);--> statement-breakpoint
CREATE INDEX `trip_registrations_trip_status_index` ON `trip_registrations` (`trip_id`,`status`);--> statement-breakpoint
CREATE INDEX `trip_registrations_user_id_index` ON `trip_registrations` (`user_id`);--> statement-breakpoint
ALTER TABLE `trip_memberships` ADD `is_vip` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trip_memberships` ADD `gender_confirmed` integer DEFAULT false NOT NULL;