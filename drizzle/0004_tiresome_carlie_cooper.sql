CREATE TABLE `execution_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`command_id` int NOT NULL,
	`project_id` int NOT NULL,
	`task_id` int,
	`status` enum('ready','blocked','superseded') NOT NULL DEFAULT 'ready',
	`summary` varchar(512) NOT NULL,
	`steps` text NOT NULL,
	`constraints` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `execution_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `execution_plans_command_unique` UNIQUE(`command_id`)
);
--> statement-breakpoint
ALTER TABLE `execution_plans` ADD CONSTRAINT `execution_plans_command_id_execution_commands_id_fk` FOREIGN KEY (`command_id`) REFERENCES `execution_commands`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_plans` ADD CONSTRAINT `execution_plans_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_plans` ADD CONSTRAINT `execution_plans_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `execution_plans_project_created_idx` ON `execution_plans` (`project_id`,`created_at`);