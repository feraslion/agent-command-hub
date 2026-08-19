CREATE TABLE `worker_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`desired_enabled` int NOT NULL DEFAULT 0,
	`runtime_status` enum('disabled','awaiting_service','ready','offline') NOT NULL DEFAULT 'disabled',
	`service_label` varchar(128) NOT NULL DEFAULT 'Managed worker',
	`last_heartbeat_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `worker_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `worker_settings_owner_unique` UNIQUE(`owner_id`)
);
--> statement-breakpoint
ALTER TABLE `worker_settings` ADD CONSTRAINT `worker_settings_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;