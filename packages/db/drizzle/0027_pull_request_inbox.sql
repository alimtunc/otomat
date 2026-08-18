PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pull_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_id` text,
	`run_id` text,
	`repository_id` text,
	`provider` text DEFAULT 'github' NOT NULL,
	`origin` text DEFAULT 'otomat' NOT NULL,
	`provenance` text DEFAULT 'otomat' NOT NULL,
	`author_login` text,
	`review_decision` text,
	`checks_state` text DEFAULT 'none' NOT NULL,
	`mergeable` text DEFAULT 'unknown' NOT NULL,
	`requested_reviewers` text DEFAULT '[]' NOT NULL,
	`provider_updated_at` text,
	`synced_at` text,
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
INSERT INTO `__new_pull_requests`("id", "issue_id", "run_id", "repository_id", "provider", "origin", "provenance", "author_login", "number", "url", "status", "publication_status", "title", "body", "head_ref", "base_ref", "head_sha", "base_sha", "commit_subject", "commit_body", "generator_runtime", "generator_model", "generator_effort", "published_head_sha", "published_diff_sha", "attached_at", "attached_by", "attachment_evidence", "detached_at", "error_code", "error_message", "created_at", "updated_at") SELECT "id", "issue_id", "run_id", "repository_id", "provider", "origin", "provenance", "author_login", "number", "url", "status", "publication_status", "title", "body", "head_ref", "base_ref", "head_sha", "base_sha", "commit_subject", "commit_body", "generator_runtime", "generator_model", "generator_effort", "published_head_sha", "published_diff_sha", "attached_at", "attached_by", "attachment_evidence", "detached_at", "error_code", "error_message", "created_at", "updated_at" FROM `pull_requests`;--> statement-breakpoint
DROP TABLE `pull_requests`;--> statement-breakpoint
ALTER TABLE `__new_pull_requests` RENAME TO `pull_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `pull_requests_run_id_unique` ON `pull_requests` (`run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pull_requests_repository_number_unique` ON `pull_requests` (`repository_id`,`number`) WHERE "pull_requests"."number" is not null and "pull_requests"."detached_at" is null;--> statement-breakpoint
ALTER TABLE `daemon_settings` ADD `github_viewer_login` text;--> statement-breakpoint
ALTER TABLE `daemon_settings` ADD `github_viewer_teams_json` text;