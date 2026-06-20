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
