import type { ExecutionHostDescriptor, WorkspaceEntry, WorkspaceOpenTarget } from "@otomat/domain";

export interface WorkspaceOpenAvailability {
  available: boolean;
  reason: string | null;
}

/** Mirrors the main process's own checks, so a refused action is disabled with its reason instead of failing on click. */
export function workspaceOpenAvailability(
  entry: WorkspaceEntry | null,
  host: ExecutionHostDescriptor,
  target: WorkspaceOpenTarget,
): WorkspaceOpenAvailability {
  if (entry === null) return { available: false, reason: "No worktree exists for this work yet." };
  if (!entry.present) {
    return { available: false, reason: `The worktree directory is missing on ${host.label}.` };
  }
  if (target === "terminal" && host.kind === "ssh") {
    return {
      available: false,
      reason: `No terminal integration exists for ${host.label}; copy the ssh command instead.`,
    };
  }
  return { available: true, reason: null };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/** Copy-only: Otomat never runs it, and every path byte is single-quoted so nothing in it is parsed. */
export function remoteShellCommand(alias: string, path: string): string {
  return `ssh -t ${alias} ${shellQuote(`cd ${shellQuote(path)} && exec "$SHELL" -l`)}`;
}
