CREATE TABLE `rateLimit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`lastRequest` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rateLimit_key_unique` ON `rateLimit` (`key`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_trip_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`gender` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trip_memberships_role_valid" CHECK("__new_trip_memberships"."role" IN ('traveler', 'companion', 'manager')),
	CONSTRAINT "trip_memberships_gender_valid" CHECK("__new_trip_memberships"."gender" IS NULL OR "__new_trip_memberships"."gender" IN ('M', 'F'))
);
--> statement-breakpoint
INSERT INTO `__new_trip_memberships`("id", "trip_id", "user_id", "role", "first_name", "last_name", "gender") SELECT "id", "trip_id", "user_id", "role", "first_name", "last_name", "gender" FROM `trip_memberships`;--> statement-breakpoint
DROP TABLE `trip_memberships`;--> statement-breakpoint
ALTER TABLE `__new_trip_memberships` RENAME TO `trip_memberships`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `trip_memberships_trip_user_unique` ON `trip_memberships` (`trip_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `trip_memberships_user_id_index` ON `trip_memberships` (`user_id`);