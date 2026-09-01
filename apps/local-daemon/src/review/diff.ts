import { BRANCH_DIFF_SCOPE, type RunDiffScopeSelector } from "@otomat/domain";

import type { CanonicalDiff } from "#git";

import { resolveScope } from "./scope.js";
import type { ReviewContext, ReviewDiffResult, ReviewSubject, ReviewSubjectRef } from "./types.js";

/** The live canonical diff of one review subject. Null when it genuinely has none; never a fabricated diff. */
export function computeDiff(subject: ReviewSubject): CanonicalDiff | null {
  return subject.snapshot()?.diff ?? null;
}

export function getDiff(
  ctx: ReviewContext,
  ref: ReviewSubjectRef,
  request: RunDiffScopeSelector = BRANCH_DIFF_SCOPE,
): ReviewDiffResult {
  const resolved = resolveScope(ctx, ref, request);
  return {
    computedAt: new Date().toISOString(),
    diff: resolved.snapshot?.diff ?? null,
    scope: resolved.scope,
    unavailable: resolved.unavailable,
  };
}
