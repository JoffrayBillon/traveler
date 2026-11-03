CREATE TABLE `room_inventory` (
	`trip_id` text NOT NULL,
	`capacity` integer NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "room_inventory_capacity_valid" CHECK("room_inventory"."capacity" BETWEEN 1 AND 12),
	CONSTRAINT "room_inventory_quantity_valid" CHECK("room_inventory"."quantity" BETWEEN 0 AND 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_inventory_trip_capacity_unique` ON `room_inventory` (`trip_id`,`capacity`);