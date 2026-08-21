CREATE TABLE `council_opinions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int NOT NULL,
	`role` enum('research','architecture','product','ux','security','database','mobile','devops','cost','qa') NOT NULL,
	`proposal` text NOT NULL,
	`evidence_claim_ids_json` text NOT NULL,
	`risks` text NOT NULL,
	`assumptions` text NOT NULL,
	`confidence` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`requested_decision` enum('auto','review','approval') NOT NULL DEFAULT 'review',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `council_opinions_id` PRIMARY KEY(`id`),
	CONSTRAINT `council_opinions_campaign_role_unique` UNIQUE(`campaign_id`,`role`)
);
--> statement-breakpoint
CREATE TABLE `engine_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`key` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`kind` enum('internal_planner','local_runner','github_pr','openhands','mcp') NOT NULL,
	`status` enum('disabled','planning','approved') NOT NULL DEFAULT 'disabled',
	`trust_tier` enum('primary','project','secondary','untrusted') NOT NULL DEFAULT 'untrusted',
	`capabilities_json` text NOT NULL,
	`config_reference` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `engine_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `engine_connections_owner_key_unique` UNIQUE(`owner_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `engine_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`campaign_id` int,
	`engine_connection_id` int NOT NULL,
	`status` enum('planned','awaiting_approval','blocked','cancelled','completed') NOT NULL DEFAULT 'planned',
	`scope_summary` text NOT NULL,
	`correlation_id` varchar(128) NOT NULL,
	`artifact_reference` varchar(1024),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `engine_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `engine_sessions_correlation_unique` UNIQUE(`correlation_id`)
);
--> statement-breakpoint
CREATE TABLE `evidence_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int NOT NULL,
	`source_id` int NOT NULL,
	`claim` text NOT NULL,
	`evidence_excerpt` text NOT NULL,
	`relevance` int NOT NULL DEFAULT 50,
	`reliability` enum('primary','project','secondary','untrusted') NOT NULL DEFAULT 'untrusted',
	`conflict_group` varchar(128),
	`status` enum('active','conflicted','rejected') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_claims_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidence_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`campaign_id` int NOT NULL,
	`question_id` int,
	`source_type` enum('official_docs','github_metadata','web','repository_scan','project_memory') NOT NULL,
	`url` varchar(2048),
	`title` varchar(512) NOT NULL,
	`author` varchar(255),
	`published_label` varchar(128),
	`content_hash` varchar(128),
	`trust_tier` enum('primary','project','secondary','untrusted') NOT NULL DEFAULT 'untrusted',
	`redacted_summary` text NOT NULL,
	`instruction_risk_detected` int NOT NULL DEFAULT 0,
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`command` text NOT NULL,
	`status` enum('draft','researching','synthesized','awaiting_decision','completed','blocked','cancelled') NOT NULL DEFAULT 'draft',
	`max_sources` int NOT NULL DEFAULT 6,
	`max_questions` int NOT NULL DEFAULT 6,
	`max_rounds` int NOT NULL DEFAULT 2,
	`decision_level` enum('auto','review','approval') NOT NULL DEFAULT 'review',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int NOT NULL,
	`question` text NOT NULL,
	`category` varchar(64) NOT NULL,
	`priority` int NOT NULL DEFAULT 2,
	`status` enum('pending','researched','blocked','skipped') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_syntheses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int NOT NULL,
	`summary` text NOT NULL,
	`consensus` text NOT NULL,
	`conflicts` text NOT NULL,
	`unknowns` text NOT NULL,
	`options_json` text NOT NULL,
	`status` enum('draft','review','approved','superseded') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_syntheses_id` PRIMARY KEY(`id`),
	CONSTRAINT `research_syntheses_campaign_unique` UNIQUE(`campaign_id`)
);
--> statement-breakpoint
ALTER TABLE `council_opinions` ADD CONSTRAINT `council_opinions_campaign_id_research_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `research_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `engine_connections` ADD CONSTRAINT `engine_connections_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `engine_sessions` ADD CONSTRAINT `engine_sessions_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `engine_sessions` ADD CONSTRAINT `engine_sessions_campaign_id_research_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `research_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `engine_sessions` ADD CONSTRAINT `engine_sessions_engine_connection_id_engine_connections_id_fk` FOREIGN KEY (`engine_connection_id`) REFERENCES `engine_connections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_claims` ADD CONSTRAINT `evidence_claims_campaign_id_research_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `research_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_claims` ADD CONSTRAINT `evidence_claims_source_id_evidence_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `evidence_sources`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_sources` ADD CONSTRAINT `evidence_sources_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_sources` ADD CONSTRAINT `evidence_sources_campaign_id_research_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `research_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_sources` ADD CONSTRAINT `evidence_sources_question_id_research_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `research_questions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_campaigns` ADD CONSTRAINT `research_campaigns_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_questions` ADD CONSTRAINT `research_questions_campaign_id_research_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `research_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_syntheses` ADD CONSTRAINT `research_syntheses_campaign_id_research_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `research_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `engine_sessions_project_status_idx` ON `engine_sessions` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `evidence_claims_campaign_status_idx` ON `evidence_claims` (`campaign_id`,`status`);--> statement-breakpoint
CREATE INDEX `evidence_claims_source_idx` ON `evidence_claims` (`source_id`);--> statement-breakpoint
CREATE INDEX `evidence_sources_campaign_trust_idx` ON `evidence_sources` (`campaign_id`,`trust_tier`);--> statement-breakpoint
CREATE INDEX `evidence_sources_project_type_idx` ON `evidence_sources` (`project_id`,`source_type`);--> statement-breakpoint
CREATE INDEX `research_campaigns_project_status_idx` ON `research_campaigns` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `research_questions_campaign_status_idx` ON `research_questions` (`campaign_id`,`status`);