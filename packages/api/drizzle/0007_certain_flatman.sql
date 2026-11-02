CREATE TABLE `transport_group_assignments` (
	`trip_id` text NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`assigned_by` text,
	`assigned_at` integer NOT NULL,
	FOREIGN KEY (`assigned_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trip_id`,`group_id`) REFERENCES `transport_groups`(`trip_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`,`user_id`) REFERENCES `trip_memberships`(`trip_id`,`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transport_group_assignments_trip_user_unique` ON `transport_group_assignments` (`trip_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `transport_group_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`group_id` text NOT NULL,
	`direction` text NOT NULL,
	`position` integer NOT NULL,
	`mode` text NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`departure_at` text,
	`arrival_at` text,
	`service_reference` text,
	FOREIGN KEY (`trip_id`,`group_id`) REFERENCES `transport_groups`(`trip_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "transport_group_segments_position_nonnegative" CHECK("transport_group_segments"."position" >= 0),
	CONSTRAINT "transport_group_segments_locations_not_blank" CHECK(length(trim("transport_group_segments"."origin")) > 0 AND length(trim("transport_group_segments"."destination")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transport_group_segments_order_unique` ON `transport_group_segments` (`trip_id`,`group_id`,`direction`,`position`);--> statement-breakpoint
CREATE TABLE `transport_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`name` text NOT NULL,
	`source_city` text NOT NULL,
	`normalized_city` text NOT NULL,
	`is_draft` integer DEFAULT true NOT NULL,
	`outbound_meeting_at` text,
	`outbound_meeting_place` text,
	`return_meeting_at` text,
	`return_meeting_place` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "transport_groups_name_not_blank" CHECK(length(trim("transport_groups"."name")) > 0),
	CONSTRAINT "transport_groups_city_not_blank" CHECK(length(trim("transport_groups"."source_city")) > 0 AND length(trim("transport_groups"."normalized_city")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transport_groups_trip_id_unique` ON `transport_groups` (`trip_id`,`id`);--> statement-breakpoint
CREATE INDEX `transport_groups_trip_city_index` ON `transport_groups` (`trip_id`,`normalized_city`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_room_change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`requester_user_id` text NOT NULL,
	`changes_json` text NOT NULL,
	`required_consents_json` text NOT NULL,
	`approved_consents_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "room_change_requests_status_valid" CHECK("__new_room_change_requests"."status" IN ('pending', 'applied', 'rejected', 'cancelled', 'expired', 'stale'))
);
--> statement-breakpoint
INSERT INTO `__new_room_change_requests`("id", "trip_id", "requester_user_id", "changes_json", "required_consents_json", "approved_consents_json", "status", "created_at", "updated_at", "expires_at") SELECT "id", "trip_id", "requester_user_id", "changes_json", "required_consents_json", "approved_consents_json", "status", "created_at", "updated_at", "created_at" + 604800000 FROM `room_change_requests`;--> statement-breakpoint
DROP TABLE `room_change_requests`;--> statement-breakpoint
ALTER TABLE `__new_room_change_requests` RENAME TO `room_change_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `room_change_requests_trip_status_index` ON `room_change_requests` (`trip_id`,`status`);--> statement-breakpoint
ALTER TABLE `rooms` ADD `is_locked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `traveler_details` ADD `transport_choice` text;--> statement-breakpoint
ALTER TABLE `traveler_details` ADD `carpool_role` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `traveler_details` ADD `carpool_driver_user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `trips` ADD `ends_on` text;--> statement-breakpoint
UPDATE `traveler_details`
SET `transport_choice` = CASE
  WHEN `transport_mode` IN ('train', 'flight') THEN 'group'
  WHEN `transport_mode` = 'none' THEN 'none'
  ELSE 'unconfirmed'
END,
`carpool_role` = CASE
  WHEN `transport_mode` = 'none' AND `carpool_preference` = 1 THEN 'undecided'
  ELSE 'none'
END;--> statement-breakpoint
INSERT INTO `transport_groups` (`id`, `trip_id`, `name`, `source_city`, `normalized_city`, `is_draft`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), `trip_id`, `departure_city`, `departure_city`, lower(trim(`departure_city`)), 1, unixepoch() * 1000, unixepoch() * 1000
FROM `traveler_details`
WHERE `transport_mode` IN ('train', 'flight') AND `departure_city` IS NOT NULL AND length(trim(`departure_city`)) > 0
GROUP BY `trip_id`, lower(trim(`departure_city`));--> statement-breakpoint
INSERT INTO `transport_group_assignments` (`trip_id`, `group_id`, `user_id`, `assigned_at`)
SELECT details.`trip_id`, groups.`id`, details.`user_id`, details.`updated_at`
FROM `traveler_details` AS details
JOIN `transport_groups` AS groups
  ON groups.`trip_id` = details.`trip_id`
  AND groups.`normalized_city` = lower(trim(details.`departure_city`))
WHERE details.`transport_mode` IN ('train', 'flight') AND details.`departure_city` IS NOT NULL AND length(trim(details.`departure_city`)) > 0;
