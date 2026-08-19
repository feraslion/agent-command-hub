CREATE TABLE `task_engine_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plan_id` int NOT NULL,
	`project_id` int NOT NULL,
	`command_id` int NOT NULL,
	`status` enum('queued','running','awaiting_review','awaiting_approval','verifying','completed','failed','blocked') NOT NULL DEFAULT 'queued',
	`current_step_order` int NOT NULL DEFAULT 0,
	`retry_count` int NOT NULL DEFAULT 0,
	`max_retries` int NOT NULL DEFAULT 2,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_engine_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_engine_runs_plan_unique` UNIQUE(`plan_id`)
);
--> statement-breakpoint
CREATE TABLE `task_engine_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`step_order` int NOT NULL,
	`agent_key` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`detail` text NOT NULL,
	`approval_level` enum('auto','review','approval') NOT NULL,
	`status` enum('pending','running','awaiting_review','awaiting_approval','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`attempt_count` int NOT NULL DEFAULT 0,
	`max_attempts` int NOT NULL DEFAULT 2,
	`output` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_engine_steps_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_engine_steps_run_order_unique` UNIQUE(`run_id`,`step_order`)
);
--> statement-breakpoint
ALTER TABLE `task_engine_runs` ADD CONSTRAINT `task_engine_runs_plan_id_execution_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `execution_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_engine_runs` ADD CONSTRAINT `task_engine_runs_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_engine_runs` ADD CONSTRAINT `task_engine_runs_command_id_execution_commands_id_fk` FOREIGN KEY (`command_id`) REFERENCES `execution_commands`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_engine_steps` ADD CONSTRAINT `task_engine_steps_run_id_task_engine_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `task_engine_runs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `task_engine_runs_project_updated_idx` ON `task_engine_runs` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `task_engine_steps_run_status_idx` ON `task_engine_steps` (`run_id`,`status`);