import { spawnSync } from "node:child_process";

import { GitCommandError } from "./errors.js";

export interface RunGitOptions {
  cwd: string;
  /** Env overrides merged onto a git-isolated copy of `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** When true, a non-zero exit returns the result instead of throwing. */
  allowFailure?: boolean;
  /** Bounds a command that can wait on a network peer; `spawnSync` blocks the whole daemon without it. */
  timeoutMs?: number;
}

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface GitBytesResult {
  stdout: Buffer;
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

/** `spawnSync` reports a timeout as an error, not an exit code; `allowFailure` still owns whether it throws. */
function timeoutStderr(error: Error, args: readonly string[], options: RunGitOptions): string {
  if (!("code" in error) || error.code !== "ETIMEDOUT") throw error;
  const stderr = `timed out after ${options.timeoutMs}ms`;
  if (!options.allowFailure) throw new GitCommandError(args, options.cwd, null, stderr);
  return stderr;
}

/** Runs `git` with array args (no shell), capturing stdout/stderr as UTF-8. */
export function runGit(args: readonly string[], options: RunGitOptions): GitResult {
  const result = spawnSync("git", args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...scrubGitEnv(process.env), ...options.env },
    maxBuffer: MAX_BUFFER,
    timeout: options.timeoutMs,
  });

  if (result.error) {
    return { stdout: "", stderr: timeoutStderr(result.error, args, options), exitCode: null };
  }

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

export function runGitBytes(args: readonly string[], options: RunGitOptions): GitBytesResult {
  const result = spawnSync("git", args, {
    cwd: options.cwd,
    encoding: null,
    env: { ...scrubGitEnv(process.env), ...options.env },
    maxBuffer: MAX_BUFFER,
    timeout: options.timeoutMs,
  });

  if (result.error) {
    return {
      stdout: Buffer.alloc(0),
      stderr: timeoutStderr(result.error, args, options),
      exitCode: null,
    };
  }

  const stderr = result.stderr?.toString("utf8") ?? "";
  const out: GitBytesResult = {
    stdout: result.stdout ?? Buffer.alloc(0),
    stderr,
    exitCode: result.status,
  };

  if (!options.allowFailure && result.status !== 0) {
    throw new GitCommandError(args, options.cwd, result.status, stderr);
  }
  return out;
}
