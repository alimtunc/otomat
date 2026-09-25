import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { timestamps } from "./shared.js";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    root_path: text("root_path").notNull(),
    auto_delete_workspaces: integer("auto_delete_workspaces", { mode: "boolean" })
      .notNull()
      .default(sql`1`),
    ...timestamps,
  },
  (table) => [uniqueIndex("projects_root_path_unique").on(table.root_path)],
);
