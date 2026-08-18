PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pull_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_id` text NOT NULL,
	`run_id` text,
	`repository_id` text,
	`provider` text DEFAULT 'github' NOT NULL,
	`origin` text DEFAULT 'otomat' NOT NULL,
	`provenance` text DEFAULT 'otomat' NOT NULL,
	`author_login` text,
	`number` integer,
	`url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`publication_status` text DEFAULT 'not_configured' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text,
	`head_ref` text,
	`base_ref` text,
	`head_sha` text,
	`base_sha` text,
	`commit_subject` text,
	`commit_body` text,
	`generator_runtime` text,
	`generator_model` text,
	`generator_effort` text,
	`published_head_sha` text,
	`published_diff_sha` text,
	`attached_at` text,
	`attached_by` text,
	`attachment_evidence` text,
	`detached_at` text,
	`error_code` text,
	`error_message` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_pull_requests` (
	`id`,
	`issue_id`,
	`run_id`,
	`repository_id`,
	`provider`,
	`number`,
	`url`,
	`status`,
	`publication_status`,
	`title`,
	`body`,
	`head_ref`,
	`base_ref`,
	`commit_subject`,
	`commit_body`,
	`generator_runtime`,
	`generator_model`,
	`generator_effort`,
	`published_head_sha`,
	`published_diff_sha`,
	`error_code`,
	`error_message`,
	`created_at`,
	`updated_at`
)
SELECT
	`pull_requests`.`id`,
	`runs`.`issue_id`,
	`pull_requests`.`run_id`,
	`runs`.`repository_id`,
	`pull_requests`.`provider`,
	`pull_requests`.`number`,
	`pull_requests`.`url`,
	`pull_requests`.`status`,
	`pull_requests`.`publication_status`,
	`pull_requests`.`title`,
	`pull_requests`.`body`,
	`pull_requests`.`head_ref`,
	`pull_requests`.`base_ref`,
	`pull_requests`.`commit_subject`,
	`pull_requests`.`commit_body`,
	`pull_requests`.`generator_runtime`,
	`pull_requests`.`generator_model`,
	`pull_requests`.`generator_effort`,
	`pull_requests`.`published_head_sha`,
	`pull_requests`.`published_diff_sha`,
	`pull_requests`.`error_code`,
	`pull_requests`.`error_message`,
	`pull_requests`.`created_at`,
	`pull_requests`.`updated_at`
FROM `pull_requests`
INNER JOIN `runs` ON `runs`.`id` = `pull_requests`.`run_id`;--> statement-breakpoint
DROP TABLE `pull_requests`;--> statement-breakpoint
ALTER TABLE `__new_pull_requests` RENAME TO `pull_requests`;--> statement-breakpoint
CREATE UNIQUE INDEX `pull_requests_run_id_unique` ON `pull_requests` (`run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pull_requests_repository_number_unique` ON `pull_requests` (`repository_id`,`number`) WHERE `number` is not null and `detached_at` is null;--> statement-breakpoint
CREATE TABLE `__new_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_reviews` (`id`, `subject_id`, `status`, `created_at`, `updated_at`)
SELECT `id`, `run_id`, `status`, `created_at`, `updated_at` FROM `reviews`;--> statement-breakpoint
DROP TABLE `reviews`;--> statement-breakpoint
ALTER TABLE `__new_reviews` RENAME TO `reviews`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
