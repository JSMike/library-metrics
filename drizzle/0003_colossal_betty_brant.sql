ALTER TABLE `gitlab_group` ADD `parent_group_id` integer REFERENCES gitlab_group(id);--> statement-breakpoint
CREATE INDEX `gitlab_group_parent_idx` ON `gitlab_group` (`parent_group_id`);