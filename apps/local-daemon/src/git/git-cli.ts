import { spawn } from "node:child_process";

import { GitCommandError } from "./errors.js";

export interface RunGitOptions {
  cwd: string;
  /** Env overrides merged onto a git-isolated copy of `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** When true, a non-zero exit returns the result instead of throwing. */
  allowFailure?: boolean;
  /** Bounds a command that can wait on a network peer. */
  timeoutMs?: number;
  /** Fed to stdin, for commands that hash or read content rather than a path. */
  input?: Buffer | string;
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

function outputOverflow(args: readonly string[]): Error {
  return Object.assign(new Error(`git ${args.join(" ")} wrote more than ${MAX_BUFFER} bytes`), {
    code: "ENOBUFS",
  });
}

/** A timeout is a result with no exit code, so `allowFailure` still owns whether it throws. */
function execGit(args: readonly string[], options: RunGitOptions): Promise<GitBytesResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: options.cwd,
      env: { ...scrubGitEnv(process.env), ...options.env },
      stdio: "pipe",
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let buffered = 0;
    let failure: Error | null = null;
    let timedOut = false;
    const abort = (error: Error): void => {
      failure ??= error;
      child.kill();
    };
    const collect =
      (chunks: Buffer[]) =>
      (chunk: Buffer): void => {
        buffered += chunk.length;
        if (buffered > MAX_BUFFER) abort(outputOverflow(args));
        else chunks.push(chunk);
      };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    const timer =
      options.timeoutMs === undefined
        ? null
        : setTimeout(() => {
            timedOut = true;
            child.kill();
          }, options.timeoutMs);
    let settled = false;
    const settle = (finish: () => void): void => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      finish();
    };
    child.on("error", (error) => settle(() => reject(error)));
    child.on("close", (exitCode) =>
      settle(() => {
        if (failure !== null) return reject(failure);
        if (timedOut) {
          const reason = `timed out after ${options.timeoutMs}ms`;
          return resolve({ stdout: Buffer.alloc(0), stderr: reason, exitCode: null });
        }
        resolve({
          stdout: Buffer.concat(stdout),
          stderr: Buffer.concat(stderr).toString("utf8"),
          exitCode,
        });
      }),
    );
    // git may exit before draining its input; its exit status is then the answer, not the broken pipe.
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") abort(error);
    });
    child.stdin.end(options.input);
  });
}

export async function runGitBytes(
  args: readonly string[],
  options: RunGitOptions,
): Promise<GitBytesResult> {
  const result = await execGit(args, options);
  if (!options.allowFailure && result.exitCode !== 0) {
    throw new GitCommandError(args, options.cwd, result.exitCode, result.stderr);
  }
  return result;
}

/** Runs `git` with array args (no shell), capturing stdout/stderr as UTF-8. */
export async function runGit(args: readonly string[], options: RunGitOptions): Promise<GitResult> {
  const result = await runGitBytes(args, options);
  return { ...result, stdout: result.stdout.toString("utf8") };
}
