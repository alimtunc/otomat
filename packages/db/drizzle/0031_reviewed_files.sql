CREATE TABLE `reviewed_files` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`file_path` text NOT NULL,
	`diff_sha` text NOT NULL,
	`reviewed` integer NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	`sync_error` text,
	`viewer_login` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviewed_files_review_path_unique` ON `reviewed_files` (`review_id`,`file_path`);--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `node_id` text;