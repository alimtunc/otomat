ALTER TABLE `pull_requests` ADD `title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `body` text;--> statement-breakpoint
ALTER TABLE `review_comments` ADD `hunk_snapshot` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_comments` ADD `fix_requested_at` text;