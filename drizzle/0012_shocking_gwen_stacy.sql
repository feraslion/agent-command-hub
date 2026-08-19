CREATE TABLE `agent_prompt_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`agent_key` varchar(64) NOT NULL,
	`template_key` enum('planner','coder','qa') NOT NULL,
	`custom_instructions` text NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_prompt_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_prompt_assignments_owner_agent_unique` UNIQUE(`owner_id`,`agent_key`)
);
--> statement-breakpoint
ALTER TABLE `agent_prompt_assignments` ADD CONSTRAINT `agent_prompt_assignments_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_prompt_assignments_owner_updated_idx` ON `agent_prompt_assignments` (`owner_id`,`updated_at`);
