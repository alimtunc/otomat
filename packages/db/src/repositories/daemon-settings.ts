import {
  DEFAULT_MAX_CONCURRENT_SESSIONS,
  EMPTY_EXECUTION_DEFAULTS,
  providerOptionsSchema,
  type ExecutionDefaults,
} from "@otomat/domain";
import { eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { daemonSettings } from "../schema/index.js";
import { touch } from "./touch.js";

/** A daemon holds exactly one settings row; the id is fixed so the upsert has a stable target. */
const DAEMON_SETTINGS_ID = "daemon";

type SettingsRow = typeof daemonSettings.$inferSelect;

function readRow(db: Db): SettingsRow | undefined {
  return db.select().from(daemonSettings).where(eq(daemonSettings.id, DAEMON_SETTINGS_ID)).get();
}

function upsert(db: Db, columns: Partial<SettingsRow>): void {
  db.insert(daemonSettings)
    .values({
      id: DAEMON_SETTINGS_ID,
      max_concurrent_sessions: DEFAULT_MAX_CONCURRENT_SESSIONS,
      ...columns,
    })
    .onConflictDoUpdate({ target: daemonSettings.id, set: touch(columns) })
    .run();
}

/** The host's session cap. A daemon that was never configured answers the shipped default. */
export function readMaxConcurrentSessions(db: Db): number {
  return readRow(db)?.max_concurrent_sessions ?? DEFAULT_MAX_CONCURRENT_SESSIONS;
}

export function writeMaxConcurrentSessions(db: Db, maxConcurrentSessions: number): void {
  if (!Number.isInteger(maxConcurrentSessions) || maxConcurrentSessions < 1) {
    throw new RangeError(
      `max_concurrent_sessions must be a positive integer, got ${maxConcurrentSessions}`,
    );
  }
  db.insert(daemonSettings)
    .values({ id: DAEMON_SETTINGS_ID, max_concurrent_sessions: maxConcurrentSessions })
    .onConflictDoUpdate({
      target: daemonSettings.id,
      set: touch({ max_concurrent_sessions: maxConcurrentSessions }),
    })
    .run();
}

/** A daemon that was never configured deletes a merged workspace by itself. */
export function readAutoDeleteWorkspaces(db: Db): boolean {
  return readRow(db)?.auto_delete_workspaces ?? true;
}

export function writeAutoDeleteWorkspaces(db: Db, autoDelete: boolean): void {
  upsert(db, { auto_delete_workspaces: autoDelete });
}

/** An unconfigured daemon selects nothing rather than guessing a runtime. */
export function readExecutionDefaults(db: Db): ExecutionDefaults {
  const row = readRow(db);
  if (!row) return EMPTY_EXECUTION_DEFAULTS;
  return {
    runtime: row.execution_runtime,
    model: row.execution_model,
    options: providerOptionsSchema.parse(row.execution_options_json ?? {}),
  };
}

export function writeExecutionDefaults(db: Db, defaults: ExecutionDefaults): void {
  upsert(db, {
    execution_runtime: defaults.runtime,
    execution_model: defaults.model,
    execution_options_json: defaults.options,
  });
}

export function readPullRequestGenerator(db: Db): ExecutionDefaults {
  const row = readRow(db);
  if (!row) return EMPTY_EXECUTION_DEFAULTS;
  return {
    runtime: row.pr_generator_runtime,
    model: row.pr_generator_model,
    options: providerOptionsSchema.parse(row.pr_generator_options_json ?? {}),
  };
}

export function writePullRequestGenerator(db: Db, generator: ExecutionDefaults): void {
  upsert(db, {
    pr_generator_runtime: generator.runtime,
    pr_generator_model: generator.model,
    pr_generator_options_json: generator.options,
  });
}

export interface GitHubViewerRecord {
  login: string | null;
  /** Null when GitHub would not answer which teams the account belongs to; empty is an answered "none". */
  teams: string[] | null;
}

/** The account the last pull-request sync ran as, so the inbox classifies without asking GitHub again. */
export function readGitHubViewer(db: Db): GitHubViewerRecord {
  const row = readRow(db);
  return { login: row?.github_viewer_login ?? null, teams: row?.github_viewer_teams_json ?? null };
}

export function writeGitHubViewer(db: Db, viewer: GitHubViewerRecord): void {
  upsert(db, { github_viewer_login: viewer.login, github_viewer_teams_json: viewer.teams });
}
