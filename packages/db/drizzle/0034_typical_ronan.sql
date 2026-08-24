CREATE TABLE `run_interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step_run_id` text NOT NULL,
	`agent_session_id` text NOT NULL,
	`provider_request_id` text NOT NULL,
	`kind` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`prompt` text NOT NULL,
	`tool` text,
	`options_json` text NOT NULL,
	`answer_json` text,
	`canceled_reason` text,
	`requested_at` text NOT NULL,
	`settled_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`step_run_id`) REFERENCES `step_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_interactions_session_request_unique` ON `run_interactions` (`agent_session_id`,`provider_request_id`);
