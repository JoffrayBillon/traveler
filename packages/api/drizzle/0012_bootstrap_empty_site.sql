INSERT INTO `trips` (`id`, `name`)
SELECT 'weekend-ski-2027', 'Weekend Ski 2027'
WHERE NOT EXISTS (SELECT 1 FROM `trips`);
--> statement-breakpoint
INSERT INTO `user` (`id`, `name`, `email`, `emailVerified`, `createdAt`, `updatedAt`)
SELECT 'traveler-initial-manager', 'Joffray Billon', 'joffray.billon@gmail.com', 0,
       unixepoch() * 1000, unixepoch() * 1000
WHERE NOT EXISTS (SELECT 1 FROM `user`);
--> statement-breakpoint
INSERT INTO `trip_memberships` (`id`, `trip_id`, `user_id`, `role`, `first_name`, `last_name`)
SELECT 'traveler-initial-manager-membership', `trips`.`id`, `user`.`id`,
       'manager', 'Joffray', 'Billon'
FROM `trips`
CROSS JOIN `user`
WHERE `user`.`id` = 'traveler-initial-manager'
  AND `user`.`email` = 'joffray.billon@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM `user` AS other WHERE other.`id` <> `user`.`id`)
  AND NOT EXISTS (
    SELECT 1 FROM `trip_memberships` WHERE `user_id` = `user`.`id`
  )
ORDER BY `trips`.`id`
LIMIT 1;
