import { mkdirSync } from "node:fs";

/** Anything that can receive the derived root; `Electron.App` satisfies it. */
export interface UserDataTarget {
  setPath(name: "userData", value: string): void;
}

/**
 * Creates the root a dev worktree or a channel resolved and points userData at it; must run before
 * Electron reads either. Null leaves Electron's own userData alone.
 */
export function applyUserDataRoot(root: string | null, target: UserDataTarget): void {
  if (root === null) return;
  mkdirSync(root, { recursive: true, mode: 0o700 });
  target.setPath("userData", root);
}
