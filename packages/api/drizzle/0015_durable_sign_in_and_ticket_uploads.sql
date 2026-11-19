CREATE TABLE `sign_in_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sign_in_rate_limits_expiry_index` ON `sign_in_rate_limits` (`expires_at`);--> statement-breakpoint
ALTER TABLE `pending_ticket_blob_deletions` ADD `available_at` integer DEFAULT 0 NOT NULL;