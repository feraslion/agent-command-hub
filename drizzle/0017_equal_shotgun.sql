CREATE TABLE `context_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`task_id` int,
	`title` varchar(255) NOT NULL,
	`source_refs` text NOT NULL,
	`redaction_summary` text NOT NULL,
	`token_estimate` int NOT NULL DEFAULT 0,
	`status` enum('draft','sealed') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `context_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_briefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`goal` text NOT NULL,
	`scope` text NOT NULL,
	`constraints` text NOT NULL,
	`assumptions` text NOT NULL,
	`open_questions` text NOT NULL,
	`risks` text NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_briefs_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_briefs_project_unique` UNIQUE(`project_id`)
);
--> statement-breakpoint
CREATE TABLE `project_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`kind` enum('delivery','blocked') NOT NULL,
	`status` enum('draft','final') NOT NULL DEFAULT 'draft',
	`summary` text NOT NULL,
	`completed_work` text NOT NULL,
	`evidence_summary` text NOT NULL,
	`risk_summary` text NOT NULL,
	`next_step` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`finalized_at` timestamp,
	CONSTRAINT `project_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_acceptance_criteria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_id` int NOT NULL,
	`criterion` text NOT NULL,
	`status` enum('pending','verified','waived') NOT NULL DEFAULT 'pending',
	`evidence_note` text,
	`verified_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_acceptance_criteria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `work_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`status` enum('draft','review','approved','superseded') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `work_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `work_plan_id` int;--> statement-breakpoint
ALTER TABLE `context_packages` ADD CONSTRAINT `context_packages_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `context_packages` ADD CONSTRAINT `context_packages_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_briefs` ADD CONSTRAINT `project_briefs_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_reports` ADD CONSTRAINT `project_reports_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_acceptance_criteria` ADD CONSTRAINT `task_acceptance_criteria_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_plans` ADD CONSTRAINT `work_plans_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `context_packages_project_created_idx` ON `context_packages` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `project_reports_project_created_idx` ON `project_reports` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `task_acceptance_criteria_task_status_idx` ON `task_acceptance_criteria` (`task_id`,`status`);--> statement-breakpoint
CREATE INDEX `work_plans_project_updated_idx` ON `work_plans` (`project_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_work_plan_id_work_plans_id_fk` FOREIGN KEY (`work_plan_id`) REFERENCES `work_plans`(`id`) ON DELETE set null ON UPDATE no action;