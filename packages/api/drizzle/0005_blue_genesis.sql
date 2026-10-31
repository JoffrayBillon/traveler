ALTER TABLE `trip_memberships` ADD `last_login_at` integer;--> statement-breakpoint
UPDATE `trip_memberships`
SET `last_login_at` = (
	SELECT MAX(`createdAt`)
	FROM `session`
	WHERE `session`.`userId` = `trip_memberships`.`user_id`
)
WHERE EXISTS (
	SELECT 1
	FROM `session`
	WHERE `session`.`userId` = `trip_memberships`.`user_id`
);
