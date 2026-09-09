import { accessSync, constants, statSync } from "node:fs";
import { dirname } from "node:path";

import type { ProjectHealthOutcome } from "@otomat/domain";

/** The root is created on first launch, so the check is on the deepest ancestor that exists today. */
function existingAncestor(path: string): string {
  if (statSync(path, { throwIfNoEntry: false }) !== undefined) return path;
  const parent = dirname(path);
  return parent === path ? path : existingAncestor(parent);
}

export function worktreesRootCheck(worktreesRoot: string): ProjectHealthOutcome {
  const anchor = existingAncestor(worktreesRoot);
  const remediation = `Make ${anchor} a writable directory for the user running the daemon.`;

  try {
    if (!statSync(anchor).isDirectory()) {
      return {
        status: "error",
        message: `${anchor} is not a directory, so ${worktreesRoot} cannot be created.`,
        remediation,
      };
    }
    accessSync(anchor, constants.W_OK);
  } catch {
    return {
      status: "error",
      message: `${anchor} is not writable, so run worktrees cannot be created under ${worktreesRoot}.`,
      remediation,
    };
  }

  return {
    status: "ready",
    message: `${worktreesRoot} is writable on this host.`,
    remediation: null,
  };
}
