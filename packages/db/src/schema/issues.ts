import type { ExternalIssueSource, IssueSource, IssueState, SourceLabel } from "@otomat/domain";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { timestamps } from "./shared.js";
import { projects } from "./workspace.js";

export const issues = sqliteTable(
  "issues",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id),
    title: text("title").notNull(),
    body: text("body"),
    status: text("status").$type<IssueState>().notNull().default("backlog"),
    source: text("source").$type<IssueSource>().notNull().default("local"),
    source_external_id: text("source_external_id"),
    source_identifier: text("source_identifier"),
    source_url: text("source_url"),
    synced_at: text("synced_at"),
    // The last remote revision is the conflict-detection base for write-back.
    source_updated_at: text("source_updated_at"),
    source_assignee_name: text("source_assignee_name"),
    source_priority: integer("source_priority"),
    source_labels: text("source_labels", { mode: "json" }).$type<SourceLabel[]>(),
    source_state_name: text("source_state_name"),
    source_state_color: text("source_state_color"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("issues_source_external_id_unique").on(table.source, table.source_external_id),
  ],
);

export const issueSources = sqliteTable(
  "issue_sources",
  {
    id: text("id").primaryKey(),
    source: text("source").$type<ExternalIssueSource>().notNull(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id),
    external_team_id: text("external_team_id").notNull(),
    external_team_key: text("external_team_key").notNull(),
    external_team_name: text("external_team_name").notNull(),
    // Empty strings let SQLite enforce uniqueness for whole-team mappings.
    external_project_id: text("external_project_id").notNull().default(""),
    external_project_name: text("external_project_name").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("issue_sources_external_unique").on(
      table.source,
      table.external_team_id,
      table.external_project_id,
    ),
  ],
);

export const syncState = sqliteTable(
  "sync_state",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    resource: text("resource").notNull(),
    // Empty strings let SQLite enforce uniqueness for source-wide cursors.
    external_id: text("external_id").notNull().default(""),
    cursor: text("cursor"),
    last_synced_at: text("last_synced_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sync_state_scope_unique").on(table.source, table.resource, table.external_id),
  ],
);
