ALTER TABLE `train_ticket_documents` ADD `import_hash` text;--> statement-breakpoint
ALTER TABLE `train_ticket_documents` ADD `import_journey` text;--> statement-breakpoint
ALTER TABLE `train_ticket_documents` ADD `import_items` text;--> statement-breakpoint
CREATE UNIQUE INDEX `train_ticket_documents_import_hash_unique` ON `train_ticket_documents` (`trip_id`,`segment_id`,`import_hash`);--> statement-breakpoint
ALTER TABLE `train_ticket_seats` ADD `import_item_id` text;--> statement-breakpoint
ALTER TABLE `train_ticket_seats` ADD `page_numbers` text;--> statement-breakpoint
ALTER TABLE `train_ticket_seats` ADD `allocation` text DEFAULT 'pool' NOT NULL;