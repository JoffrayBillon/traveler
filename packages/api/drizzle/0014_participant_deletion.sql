CREATE TABLE `pending_ticket_blob_deletions` (
	`blob_path` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transport_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`blob_path` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transport_tickets`("id", "trip_id", "user_id", "kind", "blob_path", "original_name", "content_type", "size", "uploaded_by", "created_at") SELECT "id", "trip_id", "user_id", "kind", "blob_path", "original_name", "content_type", "size", "uploaded_by", "created_at" FROM `transport_tickets`;--> statement-breakpoint
DROP TABLE `transport_tickets`;--> statement-breakpoint
ALTER TABLE `__new_transport_tickets` RENAME TO `transport_tickets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `transport_tickets_trip_user_index` ON `transport_tickets` (`trip_id`,`user_id`);