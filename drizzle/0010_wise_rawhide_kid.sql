CREATE TABLE `sensitive_workspace_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`workspace_id` int NOT NULL,
	`approval_id` int NOT NULL,
	`requested_by_user_id` int NOT NULL,
	`path` varchar(512) NOT NULL,
	`base_version` int NOT NULL,
	`proposed_content` text NOT NULL,
	`risk_summary` text NOT NULL,
	`status` enum('pending_secondary','applied','rejected','conflicted') NOT NULL DEFAULT 'pending_secondary',
	`applied_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sensitive_workspace_changes_id` PRIMARY KEY(`id`),
	CONSTRAINT `sensitive_workspace_changes_approval_unique` UNIQUE(`approval_id`)
);
--> statement-breakpoint
ALTER TABLE `sensitive_workspace_changes` ADD CONSTRAINT `sensitive_workspace_changes_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sensitive_workspace_changes` ADD CONSTRAINT `sensitive_workspace_changes_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sensitive_workspace_changes` ADD CONSTRAINT `sensitive_workspace_changes_approval_id_approvals_id_fk` FOREIGN KEY (`approval_id`) REFERENCES `approvals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sensitive_workspace_changes` ADD CONSTRAINT `sensitive_workspace_changes_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sensitive_workspace_changes_project_created_idx` ON `sensitive_workspace_changes` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sensitive_workspace_changes_workspace_path_idx` ON `sensitive_workspace_changes` (`workspace_id`,`path`);