CREATE TABLE `usage_file_result` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`sync_id` integer NOT NULL,
	`target_key` text NOT NULL,
	`sub_target_key` text,
	`query_key` text NOT NULL,
	`file_path` text NOT NULL,
	`match_count` integer DEFAULT 0 NOT NULL,
	`scanned_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sync_id`) REFERENCES `sync_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `usage_file_result_project_query_idx` ON `usage_file_result` (`project_id`,`sync_id`,`query_key`);--> statement-breakpoint
CREATE INDEX `usage_file_result_target_idx` ON `usage_file_result` (`target_key`,`sync_id`);--> statement-breakpoint
CREATE INDEX `usage_file_result_target_sub_idx` ON `usage_file_result` (`target_key`,`sub_target_key`,`sync_id`);--> statement-breakpoint
CREATE INDEX `usage_file_result_query_idx` ON `usage_file_result` (`query_key`,`sync_id`);