CREATE TABLE `agent_executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`task_id` int,
	`context_package_id` int NOT NULL,
	`model_run_id` int,
	`work_plan_id` int,
	`artifact_id` int,
	`role` enum('planner','coder','qa','reviewer','debugger') NOT NULL,
	`status` enum('queued','running','awaiting_review','completed','failed','blocked','cancelled') NOT NULL DEFAULT 'queued',
	`request_key` varchar(180) NOT NULL,
	`output_summary` text,
	`error_summary` text,
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agent_executions` ADD CONSTRAINT `agent_executions_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD CONSTRAINT `agent_executions_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD CONSTRAINT `agent_executions_context_package_id_context_packages_id_fk` FOREIGN KEY (`context_package_id`) REFERENCES `context_packages`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD CONSTRAINT `agent_executions_model_run_id_agent_model_runs_id_fk` FOREIGN KEY (`model_run_id`) REFERENCES `agent_model_runs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD CONSTRAINT `agent_executions_work_plan_id_work_plans_id_fk` FOREIGN KEY (`work_plan_id`) REFERENCES `work_plans`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD CONSTRAINT `agent_executions_artifact_id_artifacts_id_fk` FOREIGN KEY (`artifact_id`) REFERENCES `artifacts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_executions_project_created_idx` ON `agent_executions` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `agent_executions_project_request_idx` ON `agent_executions` (`project_id`,`request_key`);--> statement-breakpoint
CREATE INDEX `agent_executions_context_status_idx` ON `agent_executions` (`context_package_id`,`status`);