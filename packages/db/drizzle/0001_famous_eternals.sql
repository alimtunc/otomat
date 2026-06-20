ALTER TABLE `worktrees` ADD `owner_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `worktrees_owner_active_unique` ON `worktrees` (`owner_token`) WHERE status = 'active';