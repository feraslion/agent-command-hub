CREATE TABLE `planner_task_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`work_plan_id` int NOT NULL,
	`execution_id` int NOT NULL,
	`task_id` int,
	`position` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`stage` varchar(128) NOT NULL DEFAULT 'planning',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`acceptance_criteria_json` text NOT NULL,
	`status` enum('draft','applied','discarded') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `planner_task_proposals_id` PRIMARY KEY(`id`),
	CONSTRAINT `planner_task_proposals_plan_position_unique` UNIQUE(`work_plan_id`,`position`)
);
--> statement-breakpoint
ALTER TABLE `planner_task_proposals` ADD CONSTRAINT `planner_task_proposals_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `planner_task_proposals` ADD CONSTRAINT `planner_task_proposals_work_plan_id_work_plans_id_fk` FOREIGN KEY (`work_plan_id`) REFERENCES `work_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `planner_task_proposals` ADD CONSTRAINT `planner_task_proposals_execution_id_agent_executions_id_fk` FOREIGN KEY (`execution_id`) REFERENCES `agent_executions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `planner_task_proposals` ADD CONSTRAINT `planner_task_proposals_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `planner_task_proposals_project_status_idx` ON `planner_task_proposals` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `planner_task_proposals_execution_idx` ON `planner_task_proposals` (`execution_id`);