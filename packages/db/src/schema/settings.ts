import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { timestamps } from "./shared.js";

/** One row per daemon: settings the host owns and applies to its own runs, keyed by a fixed id. */
export const daemonSettings = sqliteTable("daemon_settings", {
  id: text("id").primaryKey(),
  max_concurrent_sessions: integer("max_concurrent_sessions").notNull(),
  ...timestamps,
});
