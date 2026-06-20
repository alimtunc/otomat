import { spawnSync } from "node:child_process";

/** A non-zero `git` exit, carrying the invocation and captured stderr. */
export class GitCommandError extends Error {
  constructor(
    readonly args: readonly string[],
    readonly cwd: string,
    readonly exitCode: number | null,
    readonly stderr: string,
  ) {
    super(`git ${args.join(" ")} failed (exit ${exitCode}): ${stderr.trim()}`);
    this.name = "GitCommandError";
  }
}

export interface RunGitOptions {
  cwd: string;
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

/** Runs `git` with array args (no shell), capturing stdout/stderr as UTF-8. */
export function runGit(args: readonly string[], options: RunGitOptions): GitResult {
  const result = spawnSync("git", args as string[], {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
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
