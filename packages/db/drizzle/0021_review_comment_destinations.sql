ALTER TABLE `review_comments` ADD `side` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_comments` ADD `start_line` integer;--> statement-breakpoint
ALTER TABLE `review_comments` ADD `destination` text DEFAULT 'agent' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_comments` ADD `publication_status` text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_comments` ADD `publication_error` text;--> statement-breakpoint
ALTER TABLE `review_comments` ADD `external_url` text;--> statement-breakpoint
ALTER TABLE `review_comments` ADD `suggestion` text;--> statement-breakpoint
ALTER TABLE `review_comments` ADD `suggestion_original` text;