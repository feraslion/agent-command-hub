CREATE TABLE `execution_commands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`task_id` int,
	`requested_by_user_id` int NOT NULL,
	`command` enum('run_project','run_task','resume_task') NOT NULL,
	`payload` text,
	`status` enum('queued','claimed','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`attempt_count` int NOT NULL DEFAULT 0,
	`max_attempts` int NOT NULL DEFAULT 3,
	`lease_owner` varchar(128),
	`leased_at` timestamp,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `execution_commands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `execution_commands` ADD CONSTRAINT `execution_commands_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_commands` ADD CONSTRAINT `execution_commands_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_commands` ADD CONSTRAINT `execution_commands_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `execution_commands_project_created_idx` ON `execution_commands` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `execution_commands_status_created_idx` ON `execution_commands` (`status`,`created_at`);