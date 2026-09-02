import { DaemonRequestError } from "@otomat/client";
import type { DiffFileContract, ReviewTarget, RunDiffScopeSelector } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";
import { blobsErrorMessage } from "@web/components/runs/diff/files/blobs-error";
import { useMemo, useState } from "react";

export interface FileBlobsContext {
  base: string | null;
  head: string | null;
}

export interface UseFileBlobsResult {
  context: FileBlobsContext | null;
  isPending: boolean;
  error: string | null;
  requested: boolean;
  /** Latched, so folding the file back and expanding it again never issues a second request. */
  request: () => void;
  retry: () => void;
}

/** `scope` must be the scope the patch came from: expanded context read from another pair of trees would not be this file. */
export function useFileBlobs(
  target: ReviewTarget,
  file: DiffFileContract,
  scope: RunDiffScopeSelector,
): UseFileBlobsResult {
  const keys = useQueryKeys();
  const [requested, setRequested] = useState(false);
  const query = useQuery({
    queryKey: keys.reviewDiffFileBlobs(target, file.path, file.sha, scope),
    queryFn: () => daemon.getDiffFileBlobs(target, file.path, file.sha, scope),
    enabled: requested && !file.binary,
    retry: (count, error) => !(error instanceof DaemonRequestError) && count < 2,
  });

  const blobs = query.data ?? null;
  // A fresh object rebuilds @git-diff-view's file — and drops its expansion — on every render.
  const context = useMemo(
    () => (blobs === null ? null : { base: blobs.base_content, head: blobs.head_content }),
    [blobs],
  );

  return {
    context,
    isPending: query.isLoading,
    error: query.error === null ? null : blobsErrorMessage(query.error),
    requested,
    request: () => setRequested(true),
    retry: () => void query.refetch(),
  };
}
