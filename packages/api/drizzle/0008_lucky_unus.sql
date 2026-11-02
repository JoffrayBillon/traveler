PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_traveler_details` (
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`activity_profile` text,
	`ski_day_three` integer DEFAULT false NOT NULL,
	`transport_mode` text,
	`transport_choice` text,
	`carpool_role` text DEFAULT 'none' NOT NULL,
	`carpool_driver_user_id` text,
	`departure_city` text,
	`outbound_date_time` text,
	`outbound_timezone` text,
	`outbound_meeting_time` text,
	`outbound_departure_time` text,
	`outbound_location` text,
	`outbound_reference` text,
	`outbound_seat` text,
	`return_date_time` text,
	`return_timezone` text,
	`return_meeting_time` text,
	`return_departure_time` text,
	`return_location` text,
	`return_reference` text,
	`return_seat` text,
	`carpool_preference` integer,
	`parking_preference` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`carpool_driver_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "traveler_details_ski_day_requires_ski" CHECK("__new_traveler_details"."ski_day_three" = 0 OR "__new_traveler_details"."activity_profile" = 'ski'),
	CONSTRAINT "traveler_details_transport_preferences_require_none" CHECK(("__new_traveler_details"."transport_mode" = 'none') OR ("__new_traveler_details"."carpool_preference" IS NULL AND "__new_traveler_details"."parking_preference" IS NULL)),
	CONSTRAINT "traveler_details_parking_requires_carpool" CHECK("__new_traveler_details"."parking_preference" IS NULL OR "__new_traveler_details"."parking_preference" = 0 OR "__new_traveler_details"."carpool_preference" = 1),
	CONSTRAINT "traveler_details_carpool_driver_consistent" CHECK(("__new_traveler_details"."carpool_role" = 'passenger' AND "__new_traveler_details"."carpool_driver_user_id" IS NOT NULL AND "__new_traveler_details"."carpool_driver_user_id" <> "__new_traveler_details"."user_id") OR ("__new_traveler_details"."carpool_role" <> 'passenger' AND "__new_traveler_details"."carpool_driver_user_id" IS NULL)),
	CONSTRAINT "traveler_details_carpool_role_valid" CHECK("__new_traveler_details"."carpool_role" IN ('none', 'driver', 'passenger', 'undecided')),
	CONSTRAINT "traveler_details_transport_choice_valid" CHECK("__new_traveler_details"."transport_choice" IS NULL OR "__new_traveler_details"."transport_choice" IN ('group', 'none', 'unconfirmed'))
);
--> statement-breakpoint
INSERT INTO `__new_traveler_details`("trip_id", "user_id", "activity_profile", "ski_day_three", "transport_mode", "transport_choice", "carpool_role", "carpool_driver_user_id", "departure_city", "outbound_date_time", "outbound_timezone", "outbound_meeting_time", "outbound_departure_time", "outbound_location", "outbound_reference", "outbound_seat", "return_date_time", "return_timezone", "return_meeting_time", "return_departure_time", "return_location", "return_reference", "return_seat", "carpool_preference", "parking_preference", "updated_at") SELECT "trip_id", "user_id", "activity_profile", "ski_day_three", "transport_mode", "transport_choice", "carpool_role", "carpool_driver_user_id", "departure_city", "outbound_date_time", "outbound_timezone", "outbound_meeting_time", "outbound_departure_time", "outbound_location", "outbound_reference", "outbound_seat", "return_date_time", "return_timezone", "return_meeting_time", "return_departure_time", "return_location", "return_reference", "return_seat", "carpool_preference", "parking_preference", "updated_at" FROM `traveler_details`;--> statement-breakpoint
DROP TABLE `traveler_details`;--> statement-breakpoint
ALTER TABLE `__new_traveler_details` RENAME TO `traveler_details`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `traveler_details_trip_user_unique` ON `traveler_details` (`trip_id`,`user_id`);