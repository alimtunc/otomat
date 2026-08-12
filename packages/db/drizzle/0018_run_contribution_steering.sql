PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_run_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step_run_id` text NOT NULL,
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
	FOREIGN KEY (`step_run_id`) REFERENCES `step_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_run_contributions` (
	`id`,
	`run_id`,
	`step_run_id`,
	`seq`,
	`body`,
	`status`,
	`agent_session_id`,
	`delivered_at`,
	`settled_at`,
	`attempts`,
	`error`,
	`created_at`,
	`updated_at`
)
SELECT
	`rc`.`id`,
	`rc`.`run_id`,
	COALESCE(
		(SELECT `s`.`step_run_id` FROM `agent_sessions` `s` WHERE `s`.`id` = `rc`.`agent_session_id`),
		(SELECT `sr`.`id` FROM `step_runs` `sr` WHERE `sr`.`run_id` = `rc`.`run_id` ORDER BY `sr`.`idx` DESC LIMIT 1)
	),
	`rc`.`seq`,
	`rc`.`body`,
	CASE `rc`.`status`
		WHEN 'sent' THEN 'delivered'
		WHEN 'completed' THEN 'acknowledged'
		ELSE `rc`.`status`
	END,
	`rc`.`agent_session_id`,
	`rc`.`delivered_at`,
	`rc`.`settled_at`,
	`rc`.`attempts`,
	`rc`.`error`,
	`rc`.`created_at`,
	`rc`.`updated_at`
FROM `run_contributions` `rc`;--> statement-breakpoint
DROP TABLE `run_contributions`;--> statement-breakpoint
ALTER TABLE `__new_run_contributions` RENAME TO `run_contributions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `run_contributions_run_seq_unique` ON `run_contributions` (`run_id`,`seq`);
