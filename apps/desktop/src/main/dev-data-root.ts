import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";

import { DEV_DATA_DIRECTORY_NAME, DEV_DATA_ROOT_ENV } from "#shared/constants";

const WORKTREE_KEY_HEX_LENGTH = 12;
const UNNAMED_WORKTREE = "worktree";

export interface DevDataRootOptions {
  /** Checkout the running main process was built from; its canonical path keys the root. */
  repoRoot: string;
  /** Electron's `appData` directory — the parent of the packaged app's own userData. */
  appData: string;
  env: NodeJS.ProcessEnv;
}

/**
 * Dev-only data root keyed by the canonical worktree path, so parallel checkouts never share the
 * SQLite database, run artifacts, generated git worktrees, or Electron's single-instance lock.
 */
export function resolveDevDataRoot(options: DevDataRootOptions): string {
  const override = options.env[DEV_DATA_ROOT_ENV]?.trim() ?? "";
  if (override !== "") {
    if (!isAbsolute(override)) {
      throw new Error(`${DEV_DATA_ROOT_ENV} must be an absolute path, received "${override}".`);
    }
    return resolve(override);
  }
  const worktree = realpathSync.native(resolve(options.repoRoot));
  return join(options.appData, DEV_DATA_DIRECTORY_NAME, worktreeKey(worktree));
}

function worktreeKey(worktree: string): string {
  const digest = createHash("sha256").update(worktree).digest("hex");
  const name = basename(worktree)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${name === "" ? UNNAMED_WORKTREE : name}-${digest.slice(0, WORKTREE_KEY_HEX_LENGTH)}`;
}
