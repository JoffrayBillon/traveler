CREATE TABLE `room_assignment_history` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`actor_user_id` text,
	`actor_name` text NOT NULL,
	`action_type` text NOT NULL,
	`changes_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "room_assignment_history_action_type_valid" CHECK("room_assignment_history"."action_type" IN ('organizer_move', 'plan_generation', 'plan_reset', 'roster_import'))
);
--> statement-breakpoint
CREATE INDEX `room_assignment_history_trip_created_index` ON `room_assignment_history` (`trip_id`,`created_at`);