CREATE TABLE `project_repository_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`runner_id` int,
	`remote_url` varchar(512),
	`repository_name` varchar(255),
	`default_branch` varchar(128) NOT NULL DEFAULT 'main',
	`status` enum('unlinked','scanned','stale') NOT NULL DEFAULT 'unlinked',
	`last_scanned_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_repository_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_repository_links_project_id_unique` UNIQUE(`project_id`)
);
--> statement-breakpoint
CREATE TABLE `repository_scans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`runner_id` int NOT NULL,
	`display_name` varchar(255) NOT NULL,
	`file_count` int NOT NULL DEFAULT 0,
	`directory_count` int NOT NULL DEFAULT 0,
	`language_summary` text NOT NULL,
	`manifest_summary` text NOT NULL,
	`test_summary` text NOT NULL,
	`sensitive_summary` text NOT NULL,
	`status` enum('reported','rejected') NOT NULL DEFAULT 'reported',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `repository_scans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `project_repository_links` ADD CONSTRAINT `project_repository_links_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_repository_links` ADD CONSTRAINT `project_repository_links_runner_id_local_runners_id_fk` FOREIGN KEY (`runner_id`) REFERENCES `local_runners`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repository_scans` ADD CONSTRAINT `repository_scans_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repository_scans` ADD CONSTRAINT `repository_scans_runner_id_local_runners_id_fk` FOREIGN KEY (`runner_id`) REFERENCES `local_runners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_repository_links_runner_idx` ON `project_repository_links` (`runner_id`);--> statement-breakpoint
CREATE INDEX `repository_scans_project_created_idx` ON `repository_scans` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `repository_scans_runner_created_idx` ON `repository_scans` (`runner_id`,`created_at`);