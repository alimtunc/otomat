CREATE TABLE `agent_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`runtime` text NOT NULL,
	`options_json` text NOT NULL,
	`guidance` text,
	`skill_ids_json` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`canonical_path` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`content_hash` text,
	`status` text DEFAULT 'available' NOT NULL,
	`invalid_reason` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_canonical_path_unique` ON `skills` (`canonical_path`);