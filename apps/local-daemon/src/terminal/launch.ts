import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";

import { createTerminalRecord, deleteTerminalRecord, type Db } from "@otomat/db";
import type { TerminalSession } from "@otomat/domain";

import { WorktreeConflictError } from "#git";
import { holdInteractiveWorktree } from "#git/interactive-worktrees";

import { UserTerminal } from "./session.js";

export type TerminalLaunchTarget = Pick<
  TerminalSession,
  "project_id" | "issue_id" | "worktree_id" | "path" | "branch" | "tool"
>;

export function launchTerminal(db: Db, target: TerminalLaunchTarget, argv: string[]): UserTerminal {
  const info: TerminalSession = {
    ...target,
    id: randomUUID(),
    started_at: new Date().toISOString(),
    state: "running",
    exit_code: null,
    signal: null,
  };
  const release = holdInteractiveWorktree(info.path);
  try {
    createTerminalRecord(db, info);
    return new UserTerminal(
      info,
      info.tool ?? userInfo().shell ?? "/bin/sh",
      info.tool === null ? ["-l"] : argv,
      release,
      db,
    );
  } catch {
    release();
    deleteTerminalRecord(db, info.id);
    throw new WorktreeConflictError(
      "The terminal could not start. Check the shell or CLI installation, or open an external terminal.",
    );
  }
}
