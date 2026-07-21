CREATE TABLE `issue_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`project_id` text NOT NULL,
	`external_team_id` text NOT NULL,
	`external_team_key` text NOT NULL,
	`external_team_name` text NOT NULL,
	`external_project_id` text DEFAULT '' NOT NULL,
	`external_project_name` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `issue_sources_external_unique` ON `issue_sources` (`source`,`external_team_id`,`external_project_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`resource` text NOT NULL,
	`external_id` text DEFAULT '' NOT NULL,
	`cursor` text,
	`last_synced_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sync_state` (
	`id`,
	`source`,
	`resource`,
	`external_id`,
	`cursor`,
	`last_synced_at`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`source`,
	`resource`,
	COALESCE(`external_id`, ''),
	CASE WHEN `scope_count` = 1 THEN `cursor` ELSE NULL END,
	CASE WHEN `scope_count` = 1 THEN `last_synced_at` ELSE NULL END,
	`created_at`,
	`updated_at`
FROM (
	SELECT
		*,
		ROW_NUMBER() OVER (
			PARTITION BY `source`, `resource`, COALESCE(`external_id`, '')
			ORDER BY `updated_at` DESC, `id` DESC
		) AS `scope_rank`,
		COUNT(*) OVER (
			PARTITION BY `source`, `resource`, COALESCE(`external_id`, '')
		) AS `scope_count`
	FROM `sync_state`
)
WHERE `scope_rank` = 1;--> statement-breakpoint
DROP TABLE `sync_state`;--> statement-breakpoint
ALTER TABLE `__new_sync_state` RENAME TO `sync_state`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `sync_state_scope_unique` ON `sync_state` (`source`,`resource`,`external_id`);--> statement-breakpoint
ALTER TABLE `issues` ADD `source_identifier` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `source_url` text;--> statement-breakpoint
UPDATE `issues`
SET
	`source_identifier` = `source_external_id`,
	`synced_at` = COALESCE(
		strftime('%Y-%m-%dT%H:%M:%fZ', `synced_at`),
		strftime('%Y-%m-%dT%H:%M:%fZ', `updated_at`),
		strftime('%Y-%m-%dT%H:%M:%fZ', `created_at`),
		strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
	)
WHERE
	`source` IN ('linear', 'github')
	AND `source_external_id` IS NOT NULL
	AND length(trim(`source_external_id`)) > 0;--> statement-breakpoint
UPDATE `issues`
SET `source` = 'local'
WHERE
	(
		`source` IN ('linear', 'github')
		AND (`source_external_id` IS NULL OR length(trim(`source_external_id`)) = 0)
	)
	OR `source` NOT IN ('local', 'linear', 'github');--> statement-breakpoint
UPDATE `issues`
SET `source` = 'local'
WHERE `id` IN (
	SELECT `id`
	FROM (
		SELECT
			`id`,
			ROW_NUMBER() OVER (
				PARTITION BY `source`, `source_external_id`
				ORDER BY `updated_at` DESC, `id` DESC
			) AS `duplicate_rank`
		FROM `issues`
		WHERE `source` IN ('linear', 'github') AND `source_external_id` IS NOT NULL
	)
	WHERE `duplicate_rank` > 1
);--> statement-breakpoint
UPDATE `issues`
SET
	`source_external_id` = NULL,
	`source_identifier` = NULL,
	`source_url` = NULL,
	`synced_at` = NULL
WHERE `source` = 'local';--> statement-breakpoint
CREATE UNIQUE INDEX `issues_source_external_id_unique` ON `issues` (`source`,`source_external_id`);
