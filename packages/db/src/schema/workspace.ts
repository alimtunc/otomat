import type { WorktreeStatus } from "@otomat/domain";
import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { timestamps } from "./shared.js";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    root_path: text("root_path").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("projects_root_path_unique").on(table.root_path)],
);

export const repositories = sqliteTable("repositories", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  remote_url: text("remote_url"),
  default_branch: text("default_branch").notNull().default("main"),
  ...timestamps,
});

export type { WorktreeStatus } from "@otomat/domain";

export const worktrees = sqliteTable(
  "worktrees",
  {
    id: text("id").primaryKey(),
    repository_id: text("repository_id")
      .notNull()
      .references(() => repositories.id),
    path: text("path").notNull(),
    branch: text("branch").notNull(),
    head_sha: text("head_sha"),
    // The partial index makes mutable worktree ownership exclusive.
    owner_token: text("owner_token"),
    status: text("status").$type<WorktreeStatus>().notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("worktrees_owner_active_unique")
      .on(table.owner_token)
      .where(sql`status = 'active'`),
  ],
);
