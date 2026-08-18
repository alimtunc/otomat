ALTER TABLE `review_comments` ADD `fixed_by_session_id` text;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `start_tree_sha` text;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `start_head_sha` text;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `end_tree_sha` text;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `end_head_sha` text;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `boundary_error` text;