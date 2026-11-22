CREATE TABLE `train_ticket_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`segment_id` text NOT NULL,
	`blob_path` text NOT NULL,
	`original_name` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`segment_id`) REFERENCES `transport_group_segments`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `train_ticket_documents_scope_unique` ON `train_ticket_documents` (`trip_id`,`segment_id`,`id`);--> statement-breakpoint
CREATE TABLE `train_ticket_seats` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`segment_id` text NOT NULL,
	`document_id` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`room_id` text,
	`user_id` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trip_id`,`segment_id`,`document_id`) REFERENCES `train_ticket_documents`(`trip_id`,`segment_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `train_ticket_seats_label_unique` ON `train_ticket_seats` (`trip_id`,`segment_id`,`label`);--> statement-breakpoint
CREATE UNIQUE INDEX `train_ticket_seats_position_unique` ON `train_ticket_seats` (`trip_id`,`segment_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `train_ticket_seats_user_unique` ON `train_ticket_seats` (`trip_id`,`user_id`,`segment_id`);--> statement-breakpoint
CREATE INDEX `train_ticket_seats_document_index` ON `train_ticket_seats` (`trip_id`,`segment_id`,`document_id`);
