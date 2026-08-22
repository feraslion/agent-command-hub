CREATE TABLE `agent_command_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`agent_key` varchar(64) NOT NULL,
	`intent` enum('plan','review','debug') NOT NULL,
	`instruction` text NOT NULL,
	`status` enum('queued','cancelled') NOT NULL DEFAULT 'queued',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_command_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`file_name` varchar(180) NOT NULL,
	`mime_type` varchar(128) NOT NULL,
	`kind` enum('image','pdf','text','zip') NOT NULL,
	`byte_size` int NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`summary` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agent_command_requests` ADD CONSTRAINT `agent_command_requests_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_attachments` ADD CONSTRAINT `chat_attachments_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_command_requests_owner_created_idx` ON `agent_command_requests` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `chat_attachments_owner_created_idx` ON `chat_attachments` (`owner_id`,`created_at`);