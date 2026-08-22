ALTER TABLE `agent_sessions` ADD `turn_index` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `agent_sessions` SET `turn_index` = (
	SELECT COUNT(*) FROM `agent_sessions` AS `prior`
	WHERE `prior`.`step_run_id` = `agent_sessions`.`step_run_id`
		AND (`prior`.`created_at` < `agent_sessions`.`created_at`
			OR (`prior`.`created_at` = `agent_sessions`.`created_at` AND `prior`.`id` < `agent_sessions`.`id`))
);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_sessions_step_turn_unique` ON `agent_sessions` (`step_run_id`,`turn_index`);
