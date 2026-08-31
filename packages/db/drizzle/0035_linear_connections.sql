CREATE TABLE `linear_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`workspace_id` text DEFAULT '' NOT NULL,
	`workspace_name` text DEFAULT '' NOT NULL,
	`user_name` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `issue_sources` ADD `connection_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
INSERT INTO `linear_connections` (`id`, `label`)
SELECT 'linear-default', 'Linear' WHERE EXISTS (SELECT 1 FROM `issue_sources`);--> statement-breakpoint
UPDATE `issue_sources` SET `connection_id` = 'linear-default';
