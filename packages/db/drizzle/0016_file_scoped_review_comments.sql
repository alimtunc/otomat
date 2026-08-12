PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_review_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`file_path` text NOT NULL,
	`line` integer,
	`diff_sha` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`hunk_snapshot` text DEFAULT '' NOT NULL,
	`fix_requested_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_review_comments` (
	`id`,
	`review_id`,
	`file_path`,
	`line`,
	`diff_sha`,
	`body`,
	`status`,
	`hunk_snapshot`,
	`fix_requested_at`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`review_id`,
	`file_path`,
	`line`,
	`diff_sha`,
	`body`,
	`status`,
	`hunk_snapshot`,
	`fix_requested_at`,
	`created_at`,
	`updated_at`
FROM `review_comments`;--> statement-breakpoint
DROP TABLE `review_comments`;--> statement-breakpoint
ALTER TABLE `__new_review_comments` RENAME TO `review_comments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
