/** A worktree cannot be acquired because its owner, branch, or path is taken. */
export class WorktreeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorktreeConflictError";
  }
}

/** No worktree is tracked for the requested owner. */
export class WorktreeNotFoundError extends Error {
  constructor(readonly owner: string) {
    super(`no worktree tracked for owner ${owner}`);
    this.name = "WorktreeNotFoundError";
  }
}

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
