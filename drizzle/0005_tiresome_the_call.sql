CREATE TABLE `workspace_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspace_id` int NOT NULL,
	`actor` varchar(128) NOT NULL,
	`action` enum('workspace_created','file_read','file_written','path_rejected','tool_rejected','sandbox_checked','gate_requested') NOT NULL,
	`path` varchar(512),
	`detail` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspace_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspace_id` int NOT NULL,
	`path` varchar(512) NOT NULL,
	`content` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_files_workspace_path_unique` UNIQUE(`workspace_id`,`path`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`mode` varchar(32) NOT NULL DEFAULT 'virtual_restricted',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaces_project_unique` UNIQUE(`project_id`)
);
--> statement-breakpoint
ALTER TABLE `workspace_audit_logs` ADD CONSTRAINT `workspace_audit_logs_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workspace_files` ADD CONSTRAINT `workspace_files_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `workspace_audit_workspace_created_idx` ON `workspace_audit_logs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `workspace_files_workspace_updated_idx` ON `workspace_files` (`workspace_id`,`updated_at`);