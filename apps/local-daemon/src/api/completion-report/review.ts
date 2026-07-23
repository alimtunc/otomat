import { reportReviewSchema, type RunCompletionReport } from "@otomat/domain";

import type { ReviewService } from "#review";

import { comparePersistedRows } from "./persisted-order.js";

interface ReviewProjectionInput {
  errors: RunCompletionReport["errors"];
  review: ReviewService;
  runId: string;
}

function projectDiff({
  errors,
  review,
  runId,
}: ReviewProjectionInput): RunCompletionReport["diff"] {
  try {
    const diff = review.getWorktreeDiff({ id: runId }).diff;
    if (diff === null) {
      return {
        state: "not_reported",
        sha: null,
        additions: null,
        deletions: null,
        files: [],
        evidence: [{ source: "diff", file_path: null }],
      };
    }
    const files = diff.files.map((file) => ({
      path: file.path,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      evidence: [{ source: "diff" as const, file_path: file.path }],
    }));
    const [firstFile, ...remainingFiles] = files;
    if (!firstFile) {
      return {
        state: "no_changes",
        sha: diff.sha,
        additions: 0,
        deletions: 0,
        files: [],
        evidence: [{ source: "diff", file_path: null }],
      };
    }
    return {
      state: "reported",
      sha: diff.sha,
      additions: diff.additions,
      deletions: diff.deletions,
      files: [firstFile, ...remainingFiles],
      evidence: [{ source: "diff", file_path: null }],
    };
  } catch (error) {
    errors.push({
      code: "diff_unavailable",
      message: `Canonical diff is unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
      evidence: [{ source: "diff", file_path: null }],
    });
    return {
      state: "unavailable",
      sha: null,
      additions: null,
      deletions: null,
      files: [],
      evidence: [{ source: "diff", file_path: null }],
    };
  }
}

function projectReview({
  errors,
  review,
  runId,
}: ReviewProjectionInput): RunCompletionReport["review"] {
  try {
    const detail = review.getReviewDetail(runId);
    const comments = detail.comments.toSorted(comparePersistedRows);
    const open = comments.filter((comment) => comment.status === "open");
    let state: RunCompletionReport["review"]["state"] = "resolved";
    if (detail.review === null && comments.length === 0) state = "not_reported";
    else if (open.length > 0) state = "open";
    const parsed = reportReviewSchema.safeParse({
      state,
      total_comments: comments.length,
      open_comments: open.map((comment) => ({
        id: comment.id,
        file_path: comment.file_path,
        line: comment.line,
        body: comment.body,
        evidence: [{ source: "review", comment_id: comment.id }],
      })),
      evidence: [{ source: "review", comment_id: null }],
    });
    if (parsed.success) return parsed.data;
  } catch (error) {
    errors.push({
      code: "review_unavailable",
      message: `Persisted review evidence could not be read: ${error instanceof Error ? error.message : "unknown error"}`,
      evidence: [{ source: "review", comment_id: null }],
    });
    return unavailableReview();
  }
  errors.push({
    code: "review_unavailable",
    message: "Persisted review evidence could not be read.",
    evidence: [{ source: "review", comment_id: null }],
  });
  return unavailableReview();
}

function unavailableReview(): RunCompletionReport["review"] {
  return {
    state: "unavailable",
    total_comments: 0,
    open_comments: [],
    evidence: [{ source: "review", comment_id: null }],
  };
}

export function projectReviewEvidence(
  input: ReviewProjectionInput,
): Pick<RunCompletionReport, "diff" | "review"> {
  return {
    diff: projectDiff(input),
    review: projectReview(input),
  };
}
