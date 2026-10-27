CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	CONSTRAINT "trips_name_not_blank" CHECK(length(trim("trips"."name")) > 0)
);
