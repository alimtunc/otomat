import type { DiffFileContract, ReviewedFileContract, ReviewTarget } from "@otomat/domain";
import { useSetReviewedFile } from "@web/api/reviews/mutations";
import { reviewedPaths, unsyncedMarks } from "@web/components/runs/diff/reviewed-files";
import { useMemo, useState } from "react";

export interface ReviewedFiles {
  paths: ReadonlySet<string>;
  unsynced: ReadonlyMap<string, ReviewedFileContract>;
  setReviewed: (path: string, reviewed: boolean) => void;
  /** Re-sends the intent GitHub has not taken; the mark itself is already persisted. */
  retrySync: (path: string) => void;
}

export function useReviewedFiles(
  target: ReviewTarget,
  marks: ReviewedFileContract[],
  files: DiffFileContract[],
): ReviewedFiles {
  const setMark = useSetReviewedFile(target);
  // Keyed by path, because the daemon answers a mark only once GitHub has taken it and the reviewer marks faster than that.
  const [unsettled, setUnsettled] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const paths = useMemo(() => reviewedPaths(marks, files, unsettled), [marks, files, unsettled]);
  const unsynced = useMemo(() => unsyncedMarks(marks), [marks]);

  const send = (path: string, diffSha: string, reviewed: boolean): void => {
    setUnsettled((current) => new Map(current).set(path, reviewed));
    setMark.mutate(
      { file_path: path, diff_sha: diffSha, reviewed },
      {
        onSettled: () =>
          setUnsettled((current) => {
            const next = new Map(current);
            next.delete(path);
            return next;
          }),
      },
    );
  };

  return {
    paths,
    unsynced,
    setReviewed: (path, reviewed) => {
      const file = files.find((candidate) => candidate.path === path);
      if (file === undefined) return;
      send(path, file.sha, reviewed);
    },
    retrySync: (path) => {
      const mark = unsynced.get(path);
      if (mark === undefined) return;
      send(path, mark.diff_sha, mark.reviewed);
    },
  };
}
