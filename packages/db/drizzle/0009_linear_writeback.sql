CREATE TABLE `linear_issue_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_id` text NOT NULL,
	`base_updated_at` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`assignee_id` text,
	`label_ids` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `linear_issue_drafts_issue_unique` ON `linear_issue_drafts` (`issue_id`);--> statement-breakpoint
CREATE TABLE `linear_writes` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_id` text NOT NULL,
	`run_id` text,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_json` text NOT NULL,
	`detail` text,
	`remote_id` text,
	`error_code` text,
	`error_message` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `linear_writes_identity_unique` ON `linear_writes` (`issue_id`,`kind`,`idempotency_key`);--> statement-breakpoint
ALTER TABLE `issues` ADD `source_updated_at` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `source_assignee_name` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `source_priority` integer;--> statement-breakpoint
ALTER TABLE `issues` ADD `source_labels` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `source_state_name` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `source_state_color` text;--> statement-breakpoint
-- Force the next Linear sync to backfill every newly added mirror column.
DELETE FROM `sync_state` WHERE `source` = 'linear';
