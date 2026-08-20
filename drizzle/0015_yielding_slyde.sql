CREATE TABLE `local_runners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`runner_key` varchar(128) NOT NULL,
	`label` varchar(128) NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`status` enum('pairing','ready','busy','offline','revoked') NOT NULL DEFAULT 'pairing',
	`capabilities` text,
	`last_heartbeat_at` timestamp,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_runners_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_runners_owner_key_unique` UNIQUE(`owner_id`,`runner_key`),
	CONSTRAINT `local_runners_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` MODIFY COLUMN `status` enum('environment_required','awaiting_approval','queued','claimed','blocked','completed','failed','cancelled') NOT NULL DEFAULT 'environment_required';--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD `approval_id` int;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD `runner_id` int;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD `profile` varchar(64) DEFAULT 'node_script' NOT NULL;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD `exit_code` int;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD `stdout` text;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD `stderr` text;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD `duration_ms` int;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD `claimed_at` timestamp;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD `completed_at` timestamp;--> statement-breakpoint
ALTER TABLE `local_runners` ADD CONSTRAINT `local_runners_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `local_runners_owner_updated_idx` ON `local_runners` (`owner_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD CONSTRAINT `isolated_runtime_requests_approval_id_approvals_id_fk` FOREIGN KEY (`approval_id`) REFERENCES `approvals`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `isolated_runtime_requests` ADD CONSTRAINT `isolated_runtime_requests_runner_id_local_runners_id_fk` FOREIGN KEY (`runner_id`) REFERENCES `local_runners`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `isolated_runtime_requests_runner_status_idx` ON `isolated_runtime_requests` (`runner_id`,`status`);--> statement-breakpoint
CREATE INDEX `isolated_runtime_requests_approval_idx` ON `isolated_runtime_requests` (`approval_id`);