CREATE TABLE `run_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`seq` integer NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`agent_session_id` text,
	`delivered_at` text,
	`settled_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_contributions_run_seq_unique` ON `run_contributions` (`run_id`,`seq`);