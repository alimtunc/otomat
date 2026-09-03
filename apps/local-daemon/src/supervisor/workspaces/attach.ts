import type { WorkspaceAttachment } from "@otomat/domain";

import { isInsideRoot, tryRealpath } from "#git";
import type { GitWorktreeEntry } from "#git/worktree-cli";

import type { WorkspaceRecord } from "./evidence.js";

export interface AttachedWorkspace {
  path: string;
  branch: string | null;
  head: string | null;
  attachment: WorkspaceAttachment;
  registered: boolean;
  record: WorkspaceRecord | null;
}

export interface AttachContext {
  repoRoot: string;
  worktreesRoot: string;
}

function canonical(path: string): string {
  return tryRealpath(path) ?? path;
}

export function attachWorkspaces(
  entries: readonly GitWorktreeEntry[],
  records: readonly WorkspaceRecord[],
  context: AttachContext,
): AttachedWorkspace[] {
  const byPath = new Map(records.map((record) => [canonical(record.path), record]));
  const repoRoot = canonical(context.repoRoot);
  const worktrees = entries.filter((entry) => !entry.bare && canonical(entry.path) !== repoRoot);
  const matched = new Map(
    worktrees.map((entry) => [entry.path, byPath.get(canonical(entry.path)) ?? null]),
  );
  const claimed = new Set(
    [...matched.values()].filter((record) => record !== null).map((record) => record.worktree_id),
  );

  const attached = worktrees.map((entry): AttachedWorkspace => {
    const base = { path: entry.path, head: entry.head, registered: true };
    const record = matched.get(entry.path) ?? null;
    if (record) {
      return {
        ...base,
        branch: entry.branch ?? record.branch,
        attachment: "record",
        record,
      };
    }
    if (entry.branch === null || !isInsideRoot(context.worktreesRoot, entry.path)) {
      return { ...base, branch: entry.branch, attachment: "none", record: null };
    }
    const candidates = records.filter(
      (candidate) =>
        candidate.branch === entry.branch &&
        !claimed.has(candidate.worktree_id) &&
        isInsideRoot(context.worktreesRoot, candidate.path),
    );
    const only = candidates.length === 1 ? candidates[0] : undefined;
    if (only === undefined) {
      return { ...base, branch: entry.branch, attachment: "ambiguous", record: null };
    }
    claimed.add(only.worktree_id);
    return { ...base, branch: entry.branch, attachment: "convention", record: only };
  });

  const unregistered = records
    .filter((record) => !claimed.has(record.worktree_id))
    .map((record): AttachedWorkspace => ({
      path: record.path,
      branch: record.branch,
      head: record.head_sha,
      attachment: "record",
      registered: false,
      record,
    }));

  return [...attached, ...unregistered];
}
