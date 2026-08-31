import type { LinearWriteKind, LinearWriteState } from "@otomat/domain";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { issues } from "./issues.js";
import { runs } from "./runs.js";
import { timestamps } from "./shared.js";

export const linearConnections = sqliteTable("linear_connections", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  workspace_id: text("workspace_id").notNull().default(""),
  workspace_name: text("workspace_name").notNull().default(""),
  user_name: text("user_name").notNull().default(""),
  ...timestamps,
});

export const linearIssueDrafts = sqliteTable(
  "linear_issue_drafts",
  {
    id: text("id").primaryKey(),
    issue_id: text("issue_id")
      .notNull()
      .references(() => issues.id),
    base_updated_at: text("base_updated_at").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    priority: integer("priority").notNull().default(0),
    assignee_id: text("assignee_id"),
    label_ids: text("label_ids", { mode: "json" }).$type<string[]>().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("linear_issue_drafts_issue_unique").on(table.issue_id)],
);

export const linearWrites = sqliteTable(
  "linear_writes",
  {
    id: text("id").primaryKey(),
    issue_id: text("issue_id")
      .notNull()
      .references(() => issues.id),
    run_id: text("run_id").references(() => runs.id),
    kind: text("kind").$type<LinearWriteKind>().notNull(),
    status: text("status").$type<LinearWriteState>().notNull().default("pending"),
    idempotency_key: text("idempotency_key").notNull(),
    payload_json: text("payload_json", { mode: "json" }).notNull(),
    detail: text("detail"),
    remote_id: text("remote_id"),
    error_code: text("error_code"),
    error_message: text("error_message"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("linear_writes_identity_unique").on(
      table.issue_id,
      table.kind,
      table.idempotency_key,
    ),
  ],
);
