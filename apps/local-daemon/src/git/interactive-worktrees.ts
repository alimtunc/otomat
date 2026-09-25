import { WorktreeConflictError } from "./errors.js";
import { tryRealpath } from "./probe.js";

const interactive = new Set<string>();

export function hasInteractiveWriter(path: string): boolean {
  return interactive.has(tryRealpath(path) ?? path);
}

export function holdInteractiveWorktree(path: string): () => void {
  if (hasInteractiveWriter(path))
    throw new WorktreeConflictError("This worktree already has a terminal.");
  const canonical = tryRealpath(path) ?? path;
  interactive.add(canonical);
  return () => {
    interactive.delete(canonical);
  };
}

export function refuseInteractiveWriter(path: string): void {
  if (hasInteractiveWriter(path))
    throw new WorktreeConflictError("End the terminal session before removing its worktree.");
}
