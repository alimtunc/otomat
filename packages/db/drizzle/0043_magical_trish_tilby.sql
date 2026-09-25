ALTER TABLE `worktrees` ADD `prepared_issue_id` text REFERENCES issues(id);--> statement-breakpoint
CREATE UNIQUE INDEX `worktrees_prepared_issue_unique` ON `worktrees` (`prepared_issue_id`);