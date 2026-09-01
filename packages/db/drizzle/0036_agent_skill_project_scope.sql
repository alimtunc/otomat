ALTER TABLE `agent_profiles` ADD `project_id` text REFERENCES projects(id);--> statement-breakpoint
ALTER TABLE `skills` ADD `project_id` text REFERENCES projects(id);--> statement-breakpoint
UPDATE `skills` SET `project_id` = (
	SELECT p.id FROM `projects` p
	WHERE substr(`skills`.`canonical_path`, 1, length(p.root_path) + 1) = p.root_path || '/'
	ORDER BY length(p.root_path) DESC LIMIT 1
) WHERE `source` = 'project';--> statement-breakpoint
UPDATE `skills` SET `status` = 'invalid', `invalid_reason` = 'path_missing'
WHERE `source` = 'project' AND `project_id` IS NULL;--> statement-breakpoint
UPDATE `agent_profiles` SET `project_id` = (
	SELECT s.project_id FROM json_each(`agent_profiles`.`skill_ids_json`) j
	JOIN `skills` s ON s.id = j.value
	WHERE s.project_id IS NOT NULL
	ORDER BY s.name LIMIT 1
);--> statement-breakpoint
ALTER TABLE `skills` DROP COLUMN `source`;