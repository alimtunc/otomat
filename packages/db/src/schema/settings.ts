import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { timestamps } from "./shared.js";

/** One row per daemon: settings the host owns and applies to its own runs, keyed by a fixed id. */
export const daemonSettings = sqliteTable("daemon_settings", {
  id: text("id").primaryKey(),
  max_concurrent_sessions: integer("max_concurrent_sessions").notNull(),
  execution_runtime: text("execution_runtime"),
  execution_model: text("execution_model"),
  execution_options_json: text("execution_options_json", { mode: "json" }),
  // Null runtime is "same as run": the generation borrows the run's own agent instead of overriding it.
  pr_generator_runtime: text("pr_generator_runtime"),
  pr_generator_model: text("pr_generator_model"),
  pr_generator_options_json: text("pr_generator_options_json", { mode: "json" }),
  // Resolved by the last pull-request sync: the account the review inbox is classified for.
  github_viewer_login: text("github_viewer_login"),
  github_viewer_teams_json: text("github_viewer_teams_json", { mode: "json" }).$type<
    string[] | null
  >(),
  ...timestamps,
});
