ALTER TABLE `agent_sessions` ADD `kind` text DEFAULT 'step' NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `supervision_json` text;
