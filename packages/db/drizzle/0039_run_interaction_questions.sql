ALTER TABLE `run_interactions` ADD `questions_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `run_interactions` DROP COLUMN `options_json`;
