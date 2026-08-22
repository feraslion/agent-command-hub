CREATE TABLE `hosting_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`provider` enum('render','tidb_cloud','railway','koyeb','manus_managed') NOT NULL,
	`kind` enum('api','database') NOT NULL,
	`label` varchar(128) NOT NULL,
	`endpoint` varchar(2048),
	`repository_url` varchar(2048),
	`notes` text,
	`status` enum('draft','ready') NOT NULL DEFAULT 'draft',
	`manual_only` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hosting_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `hosting_targets` ADD CONSTRAINT `hosting_targets_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `hosting_targets_owner_updated_idx` ON `hosting_targets` (`owner_id`,`updated_at`);