import type { WorktreeStatus } from "@otomat/domain";
import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

import { issues } from "./issues.js";
import { projects } from "./projects.js";
import { timestamps } from "./shared.js";

export { projects } from "./projects.js";

export const repositories = sqliteTable("repositories", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  remote_url: text("remote_url"),
  default_branch: text("default_branch").notNull().default("main"),
  init_commands_json: text("init_commands_json", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
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
    // Immutable fork point ("" on rows written before it was recorded); head_sha moves with every snapshot.
    base_sha: text("base_sha").notNull().default(""),
    base_ref: text("base_ref").notNull().default(""),
    // The partial index makes mutable worktree ownership exclusive.
    owner_token: text("owner_token"),
    prepared_issue_id: text("prepared_issue_id").references((): AnySQLiteColumn => issues.id),
    status: text("status").$type<WorktreeStatus>().notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("worktrees_prepared_issue_unique").on(table.prepared_issue_id),
    uniqueIndex("worktrees_owner_active_unique")
      .on(table.owner_token)
      .where(sql`status = 'active'`),
  ],
);
