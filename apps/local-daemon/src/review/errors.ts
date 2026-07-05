/** The run has no worktree, so there is no canonical diff to pin a comment to. */
export class DiffUnavailableError extends Error {
  constructor(runId: string) {
    super(`run ${runId} has no worktree diff`);
    this.name = "DiffUnavailableError";
  }
}

/** The anchor the client sent no longer matches the current diff — the reviewer must refresh. */
export class ReviewAnchorStaleError extends Error {
  constructor(filePath: string) {
    super(`diff anchor for ${filePath} does not match the current diff`);
    this.name = "ReviewAnchorStaleError";
  }
}

/** The fix selection contains unknown or non-open comments. */
export class CommentsNotFixableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentsNotFixableError";
  }
}
