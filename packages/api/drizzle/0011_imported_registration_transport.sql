ALTER TABLE `trip_registrations` ADD `imported_transport_group_id` text REFERENCES `transport_groups`(`id`) ON DELETE SET NULL;
