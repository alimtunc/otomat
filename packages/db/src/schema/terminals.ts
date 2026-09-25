import type { TerminalSession } from "@otomat/domain";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { projects } from "./projects.js";

export const terminalSessions = sqliteTable("terminal_sessions", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  session: text("session", { mode: "json" }).notNull().$type<TerminalSession>(),
  updated_at: text("updated_at").notNull(),
});

export const terminalFrames = sqliteTable(
  "terminal_frames",
  {
    terminal_id: text("terminal_id")
      .notNull()
      .references(() => terminalSessions.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    data: text("data").notNull(),
  },
  (table) => [primaryKey({ columns: [table.terminal_id, table.seq] })],
);
