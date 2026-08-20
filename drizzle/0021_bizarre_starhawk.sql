CREATE TABLE `multi_file_bundle_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`entry_path` varchar(512) NOT NULL,
	`paths_json` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `multi_file_bundle_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `multi_file_bundle_templates_project_name_unique` UNIQUE(`project_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `multi_file_bundle_templates` ADD CONSTRAINT `multi_file_bundle_templates_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `multi_file_bundle_templates_project_updated_idx` ON `multi_file_bundle_templates` (`project_id`,`updated_at`);