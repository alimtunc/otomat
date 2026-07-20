import { readReviewedFiles, writeReviewedFiles } from "@web/components/runs/diff/reviewed-files";
import { useMemo, useState } from "react";

export interface ReviewedFiles {
  paths: ReadonlySet<string>;
  setReviewed: (path: string, reviewed: boolean) => void;
}

interface ReviewedMarks {
  runId: string;
  sha: string;
  paths: ReadonlySet<string>;
}

export function useReviewedFiles(runId: string, sha: string): ReviewedFiles {
  const [marks, setMarks] = useState<ReviewedMarks>(() => ({
    runId,
    sha,
    paths: readReviewedFiles(runId, sha),
  }));

  const paths = useMemo(() => {
    if (marks.runId === runId && marks.sha === sha) return marks.paths;
    return readReviewedFiles(runId, sha);
  }, [marks, runId, sha]);

  function setReviewed(path: string, reviewedNow: boolean): void {
    const next = new Set(paths);
    if (reviewedNow) next.add(path);
    else next.delete(path);
    setMarks({ runId, sha, paths: next });
    writeReviewedFiles(runId, sha, next);
  }

  return { paths, setReviewed };
}
