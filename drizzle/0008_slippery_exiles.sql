CREATE TABLE `sandbox_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`workspace_id` int,
	`engine_run_id` int,
	`approval_id` int,
	`kind` enum('workspace_policy','logical_test','git_gate','publish_gate','delete_gate') NOT NULL,
	`status` enum('passed','blocked','awaiting_approval','rejected') NOT NULL,
	`detail` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sandbox_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sandbox_checks` ADD CONSTRAINT `sandbox_checks_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sandbox_checks` ADD CONSTRAINT `sandbox_checks_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sandbox_checks` ADD CONSTRAINT `sandbox_checks_engine_run_id_task_engine_runs_id_fk` FOREIGN KEY (`engine_run_id`) REFERENCES `task_engine_runs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sandbox_checks` ADD CONSTRAINT `sandbox_checks_approval_id_approvals_id_fk` FOREIGN KEY (`approval_id`) REFERENCES `approvals`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sandbox_checks_project_created_idx` ON `sandbox_checks` (`project_id`,`created_at`);