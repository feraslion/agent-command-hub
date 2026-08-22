ALTER TABLE `hosting_targets` ADD `last_check_status` enum('not_tested','reachable','unreachable','blocked') DEFAULT 'not_tested' NOT NULL;--> statement-breakpoint
ALTER TABLE `hosting_targets` ADD `last_check_code` int;--> statement-breakpoint
ALTER TABLE `hosting_targets` ADD `last_check_summary` varchar(255);--> statement-breakpoint
ALTER TABLE `hosting_targets` ADD `last_check_duration_ms` int;--> statement-breakpoint
ALTER TABLE `hosting_targets` ADD `last_checked_at` timestamp;