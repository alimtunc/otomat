import type { RunDiffScopeSelector } from "@otomat/domain";

import type { CanonicalDiff } from "#git";

import { resolveScope } from "./scope.js";
import type { ReviewContext, ReviewDiffResult, ReviewSubject, ReviewSubjectRef } from "./types.js";

/** The live canonical diff of one review subject. Null when it genuinely has none; never a fabricated diff. */
export async function computeDiff(subject: ReviewSubject): Promise<CanonicalDiff | null> {
  return (await subject.snapshot())?.diff ?? null;
}

export async function getDiff(
  ctx: ReviewContext,
  ref: ReviewSubjectRef,
  request: RunDiffScopeSelector,
): Promise<ReviewDiffResult> {
  const resolved = await resolveScope(ctx, ref, request);
  return {
    computedAt: new Date().toISOString(),
    diff: resolved.snapshot?.diff ?? null,
    scope: resolved.scope,
    unavailable: resolved.unavailable,
  };
}
