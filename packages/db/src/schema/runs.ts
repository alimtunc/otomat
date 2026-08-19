import type {
  AgentSessionState,
  CompeteGroupState,
  RunContributionState,
  RunState,
  SessionContext,
  StepRunState,
} from "@otomat/domain";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { agents } from "./agents.js";
import { issues } from "./issues.js";
import { timestamps } from "./shared.js";
import { repositories, worktrees } from "./workspace.js";

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  issue_id: text("issue_id")
    .notNull()
    .references(() => issues.id),
  repository_id: text("repository_id").references(() => repositories.id),
  worktree_id: text("worktree_id").references(() => worktrees.id),
  agent_id: text("agent_id").references(() => agents.id),
  status: text("status").$type<RunState>().notNull().default("queued"),
  branch: text("branch").notNull(),
  plan_json: text("plan_json", { mode: "json" }).notNull(),
  started_at: text("started_at"),
  completed_at: text("completed_at"),
  // The one manual closure of an issue's work cycle: stamped, never inferred.
  abandoned_at: text("abandoned_at"),
  ...timestamps,
});

export const competeGroups = sqliteTable(
  "compete_groups",
  {
    id: text("id").primaryKey(),
    run_id: text("run_id")
      .notNull()
      .references(() => runs.id),
    idx: integer("idx").notNull(),
    name: text("name").notNull(),
    status: text("status").$type<CompeteGroupState>().notNull().default("queued"),
    // Avoid the step_runs cycle; winner selection validates the candidate in the repository.
    winner_step_run_id: text("winner_step_run_id"),
    base_head_sha: text("base_head_sha"),
    ...timestamps,
  },
  (table) => [uniqueIndex("compete_groups_run_idx_unique").on(table.run_id, table.idx)],
);

export const stepRuns = sqliteTable(
  "step_runs",
  {
    id: text("id").primaryKey(),
    run_id: text("run_id")
      .notNull()
      .references(() => runs.id),
    idx: integer("idx").notNull(),
    name: text("name").notNull(),
    status: text("status").$type<StepRunState>().notNull().default("queued"),
    compete_group_id: text("compete_group_id").references(() => competeGroups.id),
    worktree_id: text("worktree_id").references(() => worktrees.id),
    ...timestamps,
  },
  (table) => [uniqueIndex("step_runs_run_idx_unique").on(table.run_id, table.idx)],
);

export const eventStreams = sqliteTable("event_streams", {
  id: text("id").primaryKey(),
  run_id: text("run_id")
    .notNull()
    .references(() => runs.id),
  file_path: text("file_path").notNull(),
  byte_offset: integer("byte_offset").notNull().default(0),
  ...timestamps,
});

export const agentSessions = sqliteTable("agent_sessions", {
  id: text("id").primaryKey(),
  step_run_id: text("step_run_id")
    .notNull()
    .references(() => stepRuns.id),
  agent_id: text("agent_id").references(() => agents.id),
  status: text("status").$type<AgentSessionState>().notNull().default("created"),
  provider_session_id: text("provider_session_id"),
  // The dated dossier this session was given; null on sessions that ran before contexts were captured.
  context_json: text("context_json", { mode: "json" }).$type<SessionContext>(),
  pid: integer("pid"),
  pgid: integer("pgid"),
  exit_code: integer("exit_code"),
  exit_signal: text("exit_signal"),
  start_tree_sha: text("start_tree_sha"),
  start_head_sha: text("start_head_sha"),
  end_tree_sha: text("end_tree_sha"),
  end_head_sha: text("end_head_sha"),
  boundary_error: text("boundary_error"),
  ...timestamps,
});

export const runContributions = sqliteTable(
  "run_contributions",
  {
    id: text("id").primaryKey(),
    run_id: text("run_id")
      .notNull()
      .references(() => runs.id),
    step_run_id: text("step_run_id")
      .notNull()
      .references(() => stepRuns.id),
    // FIFO order of the conversation; created_at has second granularity, so it cannot rank a burst.
    seq: integer("seq").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<RunContributionState>().notNull().default("queued"),
    agent_session_id: text("agent_session_id").references(() => agentSessions.id),
    delivered_at: text("delivered_at"),
    settled_at: text("settled_at"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    ...timestamps,
  },
  (table) => [uniqueIndex("run_contributions_run_seq_unique").on(table.run_id, table.seq)],
);

export const runtimeEvents = sqliteTable(
  "runtime_events",
  {
    id: text("id").primaryKey(),
    run_id: text("run_id")
      .notNull()
      .references(() => runs.id),
    step_run_id: text("step_run_id").references(() => stepRuns.id),
    agent_session_id: text("agent_session_id").references(() => agentSessions.id),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    source: text("source").notNull(),
    occurred_at: text("occurred_at").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    raw_ref: text("raw_ref"),
    created_at: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    uniqueIndex("runtime_events_run_seq_unique").on(table.run_id, table.seq),
    // Not partial on `runtime.usage`: SQLite cannot prove a partial predicate from a bound parameter.
    index("runtime_events_type_occurred_idx").on(table.type, table.occurred_at),
  ],
);
