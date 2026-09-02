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

/** The requested diff scope names something this run does not have; the caller picks another. */
export class DiffScopeNotFoundError extends Error {
  constructor(
    readonly code: "commit_not_found" | "session_not_found" | "step_not_found",
    message: string,
  ) {
    super(message);
    this.name = "DiffScopeNotFoundError";
  }
}

/** No comment is eligible for a fix step, or more are open than one step may carry. */
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

/** No pull request, no anchor, or a verdict GitHub would refuse — the message names which. */
export class ReviewSubmissionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewSubmissionUnavailableError";
  }
}

/** GitHub rejects a review that carries neither a summary nor a comment. */
export class ReviewSubmissionEmptyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewSubmissionEmptyError";
  }
}

/** A submission is already in flight for this pull request; a retry would post the review twice. */
export class ReviewSubmissionBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewSubmissionBusyError";
  }
}

/** GitHub refused the review; every comment it carried is marked failed and stays retryable. */
export class ReviewSubmissionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewSubmissionFailedError";
  }
}
