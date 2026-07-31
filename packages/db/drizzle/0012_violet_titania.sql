ALTER TABLE `worktrees` ADD `base_sha` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `worktrees` ADD `base_ref` text DEFAULT '' NOT NULL;
