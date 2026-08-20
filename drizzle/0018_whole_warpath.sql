CREATE TABLE `agent_model_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`task_id` int,
	`context_package_id` int NOT NULL,
	`agent_id` int,
	`reservation_id` int NOT NULL,
	`role` enum('planner','coder','qa','reviewer','debugger') NOT NULL,
	`model` varchar(128) NOT NULL,
	`status` enum('reserved','running','completed','failed','blocked','cancelled') NOT NULL DEFAULT 'reserved',
	`input_summary` text NOT NULL,
	`output_json` text,
	`output_summary` text,
	`error_summary` text,
	`attempt_number` int NOT NULL DEFAULT 1,
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_model_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_cost_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`task_id` int,
	`role` enum('planner','coder','qa','reviewer','debugger') NOT NULL,
	`model` varchar(128) NOT NULL,
	`reserved_amount` decimal(12,4) NOT NULL,
	`status` enum('reserved','settled','released','expired') NOT NULL DEFAULT 'reserved',
	`expires_at` timestamp NOT NULL,
	`settled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_cost_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agent_model_runs` ADD CONSTRAINT `agent_model_runs_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_model_runs` ADD CONSTRAINT `agent_model_runs_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_model_runs` ADD CONSTRAINT `agent_model_runs_context_package_id_context_packages_id_fk` FOREIGN KEY (`context_package_id`) REFERENCES `context_packages`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_model_runs` ADD CONSTRAINT `agent_model_runs_agent_id_agents_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_model_runs` ADD CONSTRAINT `agent_model_runs_reservation_id_model_cost_reservations_id_fk` FOREIGN KEY (`reservation_id`) REFERENCES `model_cost_reservations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `model_cost_reservations` ADD CONSTRAINT `model_cost_reservations_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `model_cost_reservations` ADD CONSTRAINT `model_cost_reservations_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_model_runs_project_created_idx` ON `agent_model_runs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `agent_model_runs_task_role_created_idx` ON `agent_model_runs` (`task_id`,`role`,`created_at`);--> statement-breakpoint
CREATE INDEX `agent_model_runs_context_idx` ON `agent_model_runs` (`context_package_id`);--> statement-breakpoint
CREATE INDEX `model_cost_reservations_project_status_idx` ON `model_cost_reservations` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `model_cost_reservations_expires_idx` ON `model_cost_reservations` (`expires_at`);