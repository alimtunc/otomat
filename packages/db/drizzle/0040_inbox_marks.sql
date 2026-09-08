CREATE TABLE `inbox_marks` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`evidence_updated_at` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
