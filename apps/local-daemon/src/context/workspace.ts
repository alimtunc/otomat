import { existsSync } from "node:fs";
import { hostname } from "node:os";

import type { PullRequestRow, RunRow } from "@otomat/db";
import {
  CONTEXT_MAX_COMMITS,
  CONTEXT_MAX_DIFF_FILES,
  type ContextPullRequest,
  type ContextWorkspace,
} from "@otomat/domain";

import {
  commitsSince,
  diffOrNull,
  uncommittedPaths,
  type CanonicalDiff,
  type RepositoryBinding,
} from "#git";

function diffContext(diff: CanonicalDiff): ContextWorkspace["diff"] {
  const listed = diff.files.slice(0, CONTEXT_MAX_DIFF_FILES);
  return {
    sha: diff.sha,
    base: diff.base,
    files: listed.map((file) => ({
      path: file.path,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
    })),
    omitted_files: diff.files.length - listed.length,
    additions: diff.additions,
    deletions: diff.deletions,
  };
}

export interface WorkspaceContextInput {
  run: RunRow;
  binding: RepositoryBinding | null;
  /** Worktree owner token: a compete candidate owns its own, every other step the run's. */
  owner: string;
}

/** Where the cycle's work lives right now, read from git at capture time; a vanished worktree says so instead of reporting a clean tree. */
export function workspaceContext(input: WorkspaceContextInput): ContextWorkspace {
  const { run, binding } = input;
  const worktree = binding?.service.get(input.owner);
  const live = worktree !== undefined && existsSync(worktree.path);
  const base = worktree?.baseRef === "" ? null : (worktree?.baseRef ?? null);
  const commits =
    live && base !== null
      ? commitsSince(worktree.path, base, "HEAD").slice(0, CONTEXT_MAX_COMMITS)
      : [];
  const uncommitted = live ? uncommittedPaths(worktree.path) : [];
  // An archived worktree still diffs from the main repository; only an active one whose directory is gone has nowhere to read.
  const diff =
    binding === null || worktree === undefined || (worktree.status === "active" && !live)
      ? null
      : diffOrNull(binding.service, input.owner);
  return {
    repository: binding?.rootPath ?? "",
    host: hostname(),
    path: live ? worktree.path : null,
    branch: worktree?.branch ?? run.branch,
    base_branch: base,
    head_sha: worktree?.headSha ?? null,
    dirty: uncommitted.length > 0,
    uncommitted_files: uncommitted.length,
    commits: commits.map((commit) => commit.subject),
    diff: diff === null ? null : diffContext(diff),
  };
}

/** The cycle's canonical pull request as the daemon already mirrors it; nothing here lets an agent call GitHub. */
export function pullRequestContext(row: PullRequestRow): ContextPullRequest | null {
  if (row.number === null || row.url === null || row.head_ref === null || row.base_ref === null) {
    return null;
  }
  return {
    number: row.number,
    url: row.url,
    title: row.title,
    state: row.status,
    head_branch: row.head_ref,
    base_branch: row.base_ref,
  };
}
