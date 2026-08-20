CREATE TABLE `isolated_runtime_bundles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`request_id` int NOT NULL,
	`entry_path` varchar(512) NOT NULL,
	`files_json` text NOT NULL,
	`total_bytes` int NOT NULL,
	`policy_version` varchar(32) NOT NULL DEFAULT 'v1',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `isolated_runtime_bundles_id` PRIMARY KEY(`id`),
	CONSTRAINT `isolated_runtime_bundles_request_unique` UNIQUE(`request_id`)
);
--> statement-breakpoint
ALTER TABLE `isolated_runtime_bundles` ADD CONSTRAINT `rt_bundle_request_fk` FOREIGN KEY (`request_id`) REFERENCES `isolated_runtime_requests`(`id`) ON DELETE cascade ON UPDATE no action;
