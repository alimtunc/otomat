import type { DiffFileContract } from "@otomat/domain";
import {
  pruneFingerprints,
  readReviewedFingerprints,
  reviewedPaths,
  writeReviewedFingerprints,
  type ReviewedFingerprints,
} from "@web/components/runs/diff/reviewed-files";
import { useMemo, useState } from "react";

export interface ReviewedFiles {
  paths: ReadonlySet<string>;
  setReviewed: (path: string, reviewed: boolean) => void;
}

export function useReviewedFiles(runId: string, files: DiffFileContract[]): ReviewedFiles {
  const [marks, setMarks] = useState<{ runId: string; fingerprints: ReviewedFingerprints }>(() => ({
    runId,
    fingerprints: readReviewedFingerprints(runId),
  }));

  const stored = marks.runId === runId ? marks.fingerprints : readReviewedFingerprints(runId);
  const paths = useMemo(() => reviewedPaths(stored, files), [stored, files]);

  const setReviewed = (path: string, reviewedNow: boolean): void => {
    const file = files.find((candidate) => candidate.path === path);
    if (file === undefined) return;
    const next = pruneFingerprints(stored, files);
    if (reviewedNow) next[path] = file.sha;
    else delete next[path];
    setMarks({ runId, fingerprints: next });
    writeReviewedFingerprints(runId, next);
  };

  return { paths, setReviewed };
}
