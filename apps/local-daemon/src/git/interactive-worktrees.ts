import { WorktreeConflictError } from "./errors.js";
import { canonicalPath } from "./probe.js";

const interactive = new Set<string>();

export function hasInteractiveWriter(path: string): boolean {
  return interactive.has(canonicalPath(path));
}

export function holdInteractiveWorktree(path: string): () => void {
  const canonical = canonicalPath(path);
  if (interactive.has(canonical))
    throw new WorktreeConflictError("This worktree already has a terminal.");
  interactive.add(canonical);
  return () => {
    interactive.delete(canonical);
  };
}

export function refuseInteractiveWriter(path: string): void {
  if (hasInteractiveWriter(path))
    throw new WorktreeConflictError("End the terminal session before removing its worktree.");
}
