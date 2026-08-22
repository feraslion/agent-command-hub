CREATE TABLE `project_build_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`import_id` int,
	`requested_by_user_id` int NOT NULL,
	`target` enum('web','android','ios','node','docker','custom') NOT NULL,
	`status` enum('draft','awaiting_approval','approved','rejected','cancelled') NOT NULL DEFAULT 'awaiting_approval',
	`title` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`approval_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_build_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`owner_id` int NOT NULL,
	`source` enum('zip','repository') NOT NULL,
	`status` enum('received','registered','rejected') NOT NULL DEFAULT 'received',
	`display_name` varchar(255) NOT NULL,
	`storage_key` varchar(512),
	`remote_url` varchar(512),
	`provider` varchar(64),
	`byte_size` int,
	`summary` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `project_build_requests` ADD CONSTRAINT `project_build_requests_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_build_requests` ADD CONSTRAINT `project_build_requests_import_id_project_imports_id_fk` FOREIGN KEY (`import_id`) REFERENCES `project_imports`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_build_requests` ADD CONSTRAINT `project_build_requests_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_build_requests` ADD CONSTRAINT `project_build_requests_approval_id_approvals_id_fk` FOREIGN KEY (`approval_id`) REFERENCES `approvals`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_imports` ADD CONSTRAINT `project_imports_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_imports` ADD CONSTRAINT `project_imports_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_build_requests_project_created_idx` ON `project_build_requests` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `project_build_requests_status_idx` ON `project_build_requests` (`status`);--> statement-breakpoint
CREATE INDEX `project_imports_project_created_idx` ON `project_imports` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `project_imports_owner_created_idx` ON `project_imports` (`owner_id`,`created_at`);