ALTER TABLE `pull_requests` ADD `commit_subject` text;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `commit_body` text;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `generator_runtime` text;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `generator_model` text;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `generator_effort` text;--> statement-breakpoint
ALTER TABLE `daemon_settings` ADD `pr_generator_runtime` text;--> statement-breakpoint
ALTER TABLE `daemon_settings` ADD `pr_generator_model` text;--> statement-breakpoint
ALTER TABLE `daemon_settings` ADD `pr_generator_options_json` text;