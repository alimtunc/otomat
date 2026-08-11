CREATE TABLE `daemon_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`max_concurrent_sessions` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
