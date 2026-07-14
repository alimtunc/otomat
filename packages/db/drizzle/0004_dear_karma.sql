ALTER TABLE `pull_requests` ADD `publication_status` text DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `head_ref` text;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `base_ref` text;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `published_head_sha` text;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `published_diff_sha` text;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `error_code` text;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `error_message` text;--> statement-breakpoint
DELETE FROM `pull_requests`
WHERE `id` IN (
	SELECT `id`
	FROM (
		SELECT
			`id`,
			ROW_NUMBER() OVER (
				PARTITION BY `run_id`
				ORDER BY `created_at` DESC, `id` DESC
			) AS `duplicate_rank`
		FROM `pull_requests`
	)
	WHERE `duplicate_rank` > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX `pull_requests_run_id_unique` ON `pull_requests` (`run_id`);
