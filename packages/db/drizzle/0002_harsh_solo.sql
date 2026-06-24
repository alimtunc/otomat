ALTER TABLE `agent_sessions` ADD `pid` integer;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `pgid` integer;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `started_at` text;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `last_seen` text;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `exit_code` integer;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `exit_signal` text;