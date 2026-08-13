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

export class FileNotInDiffError extends Error {
  constructor(filePath: string) {
    super(`${filePath} is not part of the current diff`);
    this.name = "FileNotInDiffError";
  }
}

export class FileNotExpandableError extends Error {
  constructor(filePath: string) {
    super(`${filePath} has no textual content to expand`);
    this.name = "FileNotExpandableError";
  }
}

export class FileTooLargeError extends Error {
  constructor(filePath: string) {
    super(`${filePath} is too large to expand`);
    this.name = "FileTooLargeError";
  }
}

/** The fix selection contains unknown, non-open or non-agent comments. */
export class CommentsNotFixableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentsNotFixableError";
  }
}

/** The selected lines cannot carry this comment; the message is the reviewer-facing reason. */
export class CommentRangeInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentRangeInvalidError";
  }
}

/** The comment asks for a destination this run cannot serve, such as a PR review with no pull request. */
export class CommentDestinationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentDestinationUnavailableError";
  }
}

/** GitHub refused the comment; the attempt is recorded as `failed` and stays retryable. */
export class CommentPublicationFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentPublicationFailedError";
  }
}
