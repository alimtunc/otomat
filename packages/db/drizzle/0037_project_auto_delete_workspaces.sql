ALTER TABLE `projects` ADD `auto_delete_workspaces` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `daemon_settings` DROP COLUMN `auto_delete_workspaces`;