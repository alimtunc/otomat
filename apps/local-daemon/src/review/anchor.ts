import {
  hunkCoveringRange,
  rangeShapeRefusal,
  readRangeLines,
  reviewRangeRefusal,
  suggestionRefusal,
  type CreateReviewCommentRequest,
  type PatchRange,
} from "@otomat/domain";

import { CommentRangeInvalidError } from "./errors.js";

export interface CapturedAnchor {
  startLine: number | null;
  line: number | null;
  /** Empty for a whole-file comment: a stale anchor must not fall back to the whole patch. */
  hunkSnapshot: string;
  suggestion: string | null;
  suggestionOriginal: string | null;
}

/** The line span a request anchors to, or null when it comments on the whole file. */
function anchoredRange(request: CreateReviewCommentRequest): PatchRange | null {
  if (request.line === null) return null;
  return {
    side: request.side,
    startLine: request.start_line ?? request.line,
    endLine: request.line,
  };
}

/** Expanded context puts unchanged lines on screen, so only a suggestion or a GitHub anchor has to sit inside a hunk. */
function rangeRefusal(
  patch: string,
  request: CreateReviewCommentRequest,
  range: PatchRange,
): string | null {
  if (typeof request.suggestion === "string") return suggestionRefusal(patch, range);
  if (request.destination === "pr_review") return reviewRangeRefusal(patch, range);
  return rangeShapeRefusal(range);
}

/** A range the daemon cannot cover is refused with its reason — never shortened or re-anchored. */
export function captureAnchor(patch: string, request: CreateReviewCommentRequest): CapturedAnchor {
  const range = anchoredRange(request);
  if (range === null) {
    if (request.destination === "pr_review") {
      throw new CommentRangeInvalidError(
        "GitHub anchors a review comment to lines, so a whole-file note can only go to the agent.",
      );
    }
    return {
      startLine: null,
      line: null,
      hunkSnapshot: "",
      suggestion: null,
      suggestionOriginal: null,
    };
  }
  const refusal = rangeRefusal(patch, request, range);
  if (refusal !== null) throw new CommentRangeInvalidError(refusal);

  const original = typeof request.suggestion === "string" ? readRangeLines(patch, range) : null;
  return {
    startLine: request.start_line ?? null,
    line: request.line,
    hunkSnapshot: hunkCoveringRange(patch, range)?.text ?? "",
    suggestion: request.suggestion ?? null,
    suggestionOriginal: original === null ? null : original.join("\n"),
  };
}
