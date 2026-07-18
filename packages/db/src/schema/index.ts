/**
 * Canonical Drizzle schema for the local SQLite database — the single source of
 * every table shape. Most tables default `created_at`/`updated_at` to
 * `CURRENT_TIMESTAMP` via a shared helper; `runtime_events` is the exception,
 * carrying only `created_at`. WAL mode and `foreign_keys = ON` are established by
 * `createClient`, not declared here.
 * @packageDocumentation
 */
import type {
  AgentSessionState,
  IssueSource,
  IssueState,
  PullRequestPublicationState,
  PullRequestState,
  ReviewCommentState,
  ReviewState,
  RunState,
  StepRunState,
} from "@otomat/domain";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  created_at: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
};

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  root_path: text("root_path").notNull(),
  ...timestamps,
});

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

export type WorktreeStatus = "active" | "archived" | "removed";

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
    // Exclusive owner of the mutable worktree (e.g. step_run_id). OTO-8 owns
    // worktree ownership; the partial unique index below is the hard guard.
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

export const issues = sqliteTable("issues", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id),
  title: text("title").notNull(),
  body: text("body"),
  status: text("status").$type<IssueState>().notNull().default("backlog"),
  source: text("source").$type<IssueSource>().notNull().default("local"),
  source_external_id: text("source_external_id"),
  synced_at: text("synced_at"),
  ...timestamps,
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  runtime: text("runtime").notNull(),
  ...timestamps,
});

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
  // Plan frozen at launch. There is no workflow_revisions table by design.
  plan_json: text("plan_json", { mode: "json" }).notNull(),
  started_at: text("started_at"),
  completed_at: text("completed_at"),
  ...timestamps,
});

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
    ...timestamps,
  },
  (table) => [uniqueIndex("step_runs_run_idx_unique").on(table.run_id, table.idx)],
);

export const agentSessions = sqliteTable("agent_sessions", {
  id: text("id").primaryKey(),
  step_run_id: text("step_run_id")
    .notNull()
    .references(() => stepRuns.id),
  agent_id: text("agent_id").references(() => agents.id),
  status: text("status").$type<AgentSessionState>().notNull().default("created"),
  provider_session_id: text("provider_session_id"),
  // The runtime runs as a child process whose pid/pgid survive a daemon crash,
  // so boot reconciliation can probe it.
  pid: integer("pid"),
  pgid: integer("pgid"),
  exit_code: integer("exit_code"),
  exit_signal: text("exit_signal"),
  ...timestamps,
});

// Storage structure only. OTO-7 owns the ledger, per-run seq allocator, and
// non-lossy stream-to-file ingestion.
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
  (table) => [uniqueIndex("runtime_events_run_seq_unique").on(table.run_id, table.seq)],
);

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  run_id: text("run_id")
    .notNull()
    .references(() => runs.id),
  status: text("status").$type<ReviewState>().notNull().default("open"),
  ...timestamps,
});

export const reviewComments = sqliteTable("review_comments", {
  id: text("id").primaryKey(),
  review_id: text("review_id")
    .notNull()
    .references(() => reviews.id),
  file_path: text("file_path").notNull(),
  line: integer("line").notNull(),
  // Immutable pin-to-SHA anchor: the per-file diff sha the comment was written against.
  diff_sha: text("diff_sha").notNull(),
  body: text("body").notNull(),
  status: text("status").$type<ReviewCommentState>().notNull().default("open"),
  // Captured at creation so a stale comment renders against what the reviewer saw.
  hunk_snapshot: text("hunk_snapshot").notNull().default(""),
  fix_requested_at: text("fix_requested_at"),
  ...timestamps,
});

export const pullRequests = sqliteTable(
  "pull_requests",
  {
    id: text("id").primaryKey(),
    run_id: text("run_id")
      .notNull()
      .references(() => runs.id),
    provider: text("provider").$type<"github">().notNull().default("github"),
    number: integer("number"),
    url: text("url"),
    status: text("status").$type<PullRequestState>().notNull().default("draft"),
    publication_status: text("publication_status")
      .$type<PullRequestPublicationState>()
      .notNull()
      .default("not_configured"),
    title: text("title").notNull().default(""),
    body: text("body"),
    head_ref: text("head_ref"),
    base_ref: text("base_ref"),
    published_head_sha: text("published_head_sha"),
    published_diff_sha: text("published_diff_sha"),
    error_code: text("error_code"),
    error_message: text("error_message"),
    ...timestamps,
  },
  (table) => [uniqueIndex("pull_requests_run_id_unique").on(table.run_id)],
);

// Bookkeeping for mirroring external issue trackers into local SQLite.
export const syncState = sqliteTable("sync_state", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  resource: text("resource").notNull(),
  external_id: text("external_id"),
  cursor: text("cursor"),
  last_synced_at: text("last_synced_at"),
  ...timestamps,
});
