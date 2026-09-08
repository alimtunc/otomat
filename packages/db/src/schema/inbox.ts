import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { timestamps } from "./shared.js";

/** Keyed by the projected entry id, not a row: the Inbox is a projection and the operator's reading of it is the only thing stored. */
export const inboxMarks = sqliteTable("inbox_marks", {
  entry_id: text("entry_id").primaryKey(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  evidence_updated_at: text("evidence_updated_at").notNull(),
  ...timestamps,
});
