CREATE TABLE `isolated_runtime_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`workspace_id` int NOT NULL,
	`engine_run_id` int,
	`requested_by_user_id` int NOT NULL,
	`target_path` varchar(512) NOT NULL,
	`status` enum('environment_required','blocked','approved','submitted','completed','failed') NOT NULL DEFAULT 'environment_required',
	`reason` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `isolated_runtime_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD CONSTRAINT `isolated_runtime_requests_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD CONSTRAINT `isolated_runtime_requests_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD CONSTRAINT `isolated_runtime_requests_engine_run_id_task_engine_runs_id_fk` FOREIGN KEY (`engine_run_id`) REFERENCES `task_engine_runs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD CONSTRAINT `isolated_runtime_requests_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `isolated_runtime_requests_project_created_idx` ON `isolated_runtime_requests` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `isolated_runtime_requests_workspace_created_idx` ON `isolated_runtime_requests` (`workspace_id`,`created_at`);