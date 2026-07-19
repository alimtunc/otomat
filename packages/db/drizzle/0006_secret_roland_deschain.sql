CREATE TABLE `compete_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`idx` integer NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`winner_step_run_id` text,
	`base_head_sha` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `compete_groups_run_idx_unique` ON `compete_groups` (`run_id`,`idx`);--> statement-breakpoint
CREATE TABLE `event_streams` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`file_path` text NOT NULL,
	`byte_offset` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `step_runs` ADD `compete_group_id` text REFERENCES compete_groups(id);--> statement-breakpoint
ALTER TABLE `step_runs` ADD `worktree_id` text REFERENCES worktrees(id);