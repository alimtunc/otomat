import type { CanonicalDiff } from "#git";

import type { ReviewSubject, ReviewDiffResult } from "./types.js";

/** The live canonical diff of one review subject. Null when it genuinely has none; never a fabricated diff. */
export function computeDiff(subject: ReviewSubject): CanonicalDiff | null {
  return subject.snapshot()?.diff ?? null;
}

export function getSubjectDiff(subject: ReviewSubject): ReviewDiffResult {
  return { computedAt: new Date().toISOString(), diff: computeDiff(subject) };
}
