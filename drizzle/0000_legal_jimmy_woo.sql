CREATE TABLE `dependency` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`scope` text,
	`short_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dependency_name_idx` ON `dependency` (`name`);--> statement-breakpoint
CREATE TABLE `gitlab_group` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gitlab_id` integer NOT NULL,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`web_url` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gitlab_group_gitlab_id_idx` ON `gitlab_group` (`gitlab_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `gitlab_group_path_idx` ON `gitlab_group` (`path`);--> statement-breakpoint
CREATE TABLE `gitlab_user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gitlab_user_id` integer NOT NULL,
	`username` text NOT NULL,
	`name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gitlab_user_gitlab_id_idx` ON `gitlab_user` (`gitlab_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `gitlab_user_username_idx` ON `gitlab_user` (`username`);--> statement-breakpoint
CREATE TABLE `lock_dependency_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`sync_id` integer NOT NULL,
	`dependency_id` integer NOT NULL,
	`package_path` text NOT NULL,
	`lockfile_path` text,
	`version_resolved` text NOT NULL,
	`dep_type` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sync_id`) REFERENCES `sync_run`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dependency_id`) REFERENCES `dependency`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lock_dependency_project_idx` ON `lock_dependency_snapshot` (`project_id`,`sync_id`,`dependency_id`);--> statement-breakpoint
CREATE TABLE `package_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`sync_id` integer NOT NULL,
	`package_path` text NOT NULL,
	`name` text,
	`version` text,
	`private` integer DEFAULT false,
	`workspaces_json` text,
	`is_workspace_root` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sync_id`) REFERENCES `sync_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `package_snapshot_project_sync_path_idx` ON `package_snapshot` (`project_id`,`sync_id`,`package_path`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gitlab_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	`path_with_namespace` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `gitlab_group`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_gitlab_id_idx` ON `project` (`gitlab_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_path_with_namespace_idx` ON `project` (`path_with_namespace`);--> statement-breakpoint
CREATE INDEX `project_group_idx` ON `project` (`group_id`);--> statement-breakpoint
CREATE TABLE `project_dependency_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`sync_id` integer NOT NULL,
	`dependency_id` integer NOT NULL,
	`package_path` text NOT NULL,
	`version_spec` text NOT NULL,
	`dep_type` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sync_id`) REFERENCES `sync_run`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dependency_id`) REFERENCES `dependency`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_dependency_project_idx` ON `project_dependency_snapshot` (`project_id`,`sync_id`,`dependency_id`);--> statement-breakpoint
CREATE INDEX `project_dependency_dep_idx` ON `project_dependency_snapshot` (`dependency_id`);--> statement-breakpoint
CREATE TABLE `project_external_ref_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`sync_id` integer NOT NULL,
	`system` text NOT NULL,
	`external_id` text,
	`external_key` text,
	`note` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sync_id`) REFERENCES `sync_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `external_ref_project_sync_idx` ON `project_external_ref_snapshot` (`project_id`,`sync_id`);--> statement-breakpoint
CREATE INDEX `external_ref_system_idx` ON `project_external_ref_snapshot` (`system`);--> statement-breakpoint
CREATE TABLE `project_file_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`sync_id` integer NOT NULL,
	`path` text NOT NULL,
	`ref` text,
	`blob_sha` text,
	`kind` text NOT NULL,
	`content_json` text,
	`content_raw` text,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sync_id`) REFERENCES `sync_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_file_project_sync_kind_idx` ON `project_file_snapshot` (`project_id`,`sync_id`,`kind`);--> statement-breakpoint
CREATE INDEX `project_file_project_sync_path_idx` ON `project_file_snapshot` (`project_id`,`sync_id`,`path`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_file_snapshot_unique_idx` ON `project_file_snapshot` (`project_id`,`sync_id`,`path`,`kind`);--> statement-breakpoint
CREATE TABLE `project_member_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`sync_id` integer NOT NULL,
	`gitlab_user_id` integer,
	`username` text,
	`name` text,
	`access_level` integer,
	`state` text,
	`expires_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sync_id`) REFERENCES `sync_run`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gitlab_user_id`) REFERENCES `gitlab_user`(`gitlab_user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_member_project_sync_idx` ON `project_member_snapshot` (`project_id`,`sync_id`);--> statement-breakpoint
CREATE INDEX `project_member_user_idx` ON `project_member_snapshot` (`gitlab_user_id`);--> statement-breakpoint
CREATE TABLE `project_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`sync_id` integer NOT NULL,
	`default_branch` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`visibility` text,
	`last_activity_at` integer,
	`metadata_json` text,
	`ref` text,
	`latest_commit_sha` text,
	`latest_commit_at` integer,
	`data_source_sync_id` integer,
	`is_unchanged` integer DEFAULT false NOT NULL,
	`checked_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sync_id`) REFERENCES `sync_run`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`data_source_sync_id`) REFERENCES `sync_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_snapshot_project_sync_idx` ON `project_snapshot` (`project_id`,`sync_id`);--> statement-breakpoint
CREATE INDEX `project_snapshot_project_idx` ON `project_snapshot` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_snapshot_sync_idx` ON `project_snapshot` (`sync_id`);--> statement-breakpoint
CREATE TABLE `sync_run` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `sync_run_status_idx` ON `sync_run` (`status`);--> statement-breakpoint
CREATE TABLE `usage_result` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`sync_id` integer NOT NULL,
	`target_key` text NOT NULL,
	`sub_target_key` text,
	`query_key` text NOT NULL,
	`match_count` integer DEFAULT 0 NOT NULL,
	`scanned_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sync_id`) REFERENCES `sync_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `usage_result_project_query_idx` ON `usage_result` (`project_id`,`sync_id`,`query_key`);--> statement-breakpoint
CREATE INDEX `usage_result_target_idx` ON `usage_result` (`target_key`,`sync_id`);--> statement-breakpoint
CREATE INDEX `usage_result_target_sub_idx` ON `usage_result` (`target_key`,`sub_target_key`,`sync_id`);--> statement-breakpoint
CREATE INDEX `usage_result_query_idx` ON `usage_result` (`query_key`,`sync_id`);