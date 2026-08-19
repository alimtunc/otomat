import {
  DEFAULT_MAX_CONCURRENT_SESSIONS,
  type AgentCapacity,
  type HealthResponse,
  type ProjectContract,
  type RepositoryContract,
  type WorkspaceInventory,
  type WorkspaceSettings,
} from "@otomat/domain";

export const SANDBOX_PROJECT_ID = "sandbox-project";
export const SANDBOX_REPOSITORY_ID = "sandbox-repository";

/** Fixed so every reader of the sandbox sees one timeline, whatever day it is opened. */
export const SANDBOX_NOW = "2026-08-19T09:30:00.000Z";

export const SANDBOX_PROJECT: ProjectContract = {
  id: SANDBOX_PROJECT_ID,
  name: "Otomat sandbox",
  root_path: "/sandbox/otomat",
  has_repository: true,
};

export const SANDBOX_REPOSITORY: RepositoryContract = {
  id: SANDBOX_REPOSITORY_ID,
  project_id: SANDBOX_PROJECT_ID,
  name: "otomat",
  remote_url: "git@github.com:otomat/otomat.git",
  default_branch: "main",
  init_commands: [],
  available: true,
};

export const SANDBOX_BRANCHES = ["main", "next"];

export const SANDBOX_CAPACITY: AgentCapacity = {
  max_concurrent_sessions: DEFAULT_MAX_CONCURRENT_SESSIONS,
  active_sessions: 1,
  waiting_sessions: 0,
};

export const SANDBOX_WORKSPACE_SETTINGS: WorkspaceSettings = { auto_delete_after_merge: false };

export const SANDBOX_WORKSPACES: WorkspaceInventory = {
  entries: [
    {
      id: "sandbox-worktree-1",
      repository_id: SANDBOX_REPOSITORY_ID,
      repository_name: "otomat",
      repository_path: "/sandbox/otomat",
      issue_id: "sandbox-issue-2",
      issue_identifier: "OTO-302",
      issue_title: "Stream the run ledger",
      run_id: "sandbox-run-1",
      branch: "otomat/run/sandbox-1",
      path: "/sandbox/worktrees/sandbox-run-1",
      state: "active",
      attachment: "record",
      blocker: null,
      reason: "The run still holds this workspace.",
      registered: true,
      present: true,
      dirty: false,
      head_sha: "9f2c41d6b8ae5730c1d4f0a2b6e8d3c5a7091b24",
      last_activity_at: SANDBOX_NOW,
      pull_request: {
        number: 412,
        url: "https://github.com/otomat/otomat/pull/412",
        merged: false,
      },
    },
  ],
  counts: { active: 1, cleanup_required: 0, stale: 0, missing: 0, unmanaged: 0 },
};

/** Names the build this bundle was made from, so the diagnostics surface reports the commit under test rather than a fixture's. */
export function sandboxHealth(build: string): HealthResponse {
  return {
    status: "ok",
    name: "otomat-preview-sandbox",
    version: "0.1.0",
    build,
    started_at: SANDBOX_NOW,
    db_path: "(sandbox)",
    schema: {
      migration_count: 0,
      latest_migration_at: null,
      page_count: 0,
      page_size: 4096,
    },
  };
}
