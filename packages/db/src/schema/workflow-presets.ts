import type { WorkflowPresetScope } from "@otomat/domain";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { timestamps } from "./shared.js";
import { projects } from "./workspace.js";

/** A saved workflow structure. `project_id` is set exactly when `scope` is `project`. */
export const workflowPresets = sqliteTable("workflow_presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  scope: text("scope").$type<WorkflowPresetScope>().notNull(),
  project_id: text("project_id").references(() => projects.id),
  plan_json: text("plan_json", { mode: "json" }).notNull(),
  ...timestamps,
});
