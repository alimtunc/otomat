ALTER TABLE `agent_sessions` ADD `resumed_from_session_id` text;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `config_json` text;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `reported_model` text;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `started_at` text;--> statement-breakpoint
ALTER TABLE `run_contributions` ADD `target_agent_session_id` text REFERENCES agent_sessions(id);--> statement-breakpoint
ALTER TABLE `run_contributions` ADD `target_config_json` text;--> statement-breakpoint
ALTER TABLE `step_runs` ADD `next_turn_config_json` text;