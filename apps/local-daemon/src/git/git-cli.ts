import { spawnSync } from "node:child_process";

import { GitCommandError } from "./errors.js";

export interface RunGitOptions {
  cwd: string;
  /** Env overrides merged onto a git-isolated copy of `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** When true, a non-zero exit returns the result instead of throwing. */
  allowFailure?: boolean;
}

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

const MAX_BUFFER = 256 * 1024 * 1024;

// Repo-location vars a parent process (notably a `pre-push` hook) may export;
// left in the child env they redirect a `cwd`-scoped git call at that repo.
export const GIT_ISOLATION_ENV_VARS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
] as const;

/** Returns a copy of `env` with the ambient git-location vars stripped. */
export function scrubGitEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const scrubbed = { ...env };
  for (const key of GIT_ISOLATION_ENV_VARS) delete scrubbed[key];
  return scrubbed;
}

/** Runs `git` with array args (no shell), capturing stdout/stderr as UTF-8. */
export function runGit(args: readonly string[], options: RunGitOptions): GitResult {
  const result = spawnSync("git", args as string[], {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...scrubGitEnv(process.env), ...options.env },
    maxBuffer: MAX_BUFFER,
  });

  if (result.error) throw result.error;

  const out: GitResult = {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status,
  };

  if (!options.allowFailure && result.status !== 0) {
    throw new GitCommandError(args, options.cwd, result.status, out.stderr);
  }
  return out;
}
