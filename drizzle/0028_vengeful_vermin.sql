CREATE TABLE `research_autonomy_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`public_apis_enabled` boolean NOT NULL DEFAULT false,
	`enabled_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_autonomy_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `research_autonomy_settings_owner_unique` UNIQUE(`owner_id`)
);
--> statement-breakpoint
ALTER TABLE `research_autonomy_settings` ADD CONSTRAINT `research_autonomy_settings_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;