CREATE TABLE `api_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`provider` enum('github','openrouter','public_apis') NOT NULL,
	`auth_mode` enum('oauth','api_key','none') NOT NULL,
	`status` enum('awaiting_setup','linked') NOT NULL DEFAULT 'awaiting_setup',
	`last_requested_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_connections_owner_provider_unique` UNIQUE(`owner_id`,`provider`)
);
--> statement-breakpoint
ALTER TABLE `api_connections` ADD CONSTRAINT `api_connections_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `api_connections_owner_updated_idx` ON `api_connections` (`owner_id`,`updated_at`);