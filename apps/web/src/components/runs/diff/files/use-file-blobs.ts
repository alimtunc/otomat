import { DaemonRequestError } from "@otomat/client";
import type { DiffFileContract, ReviewTarget } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { blobsErrorMessage } from "@web/components/runs/diff/files/blobs-error";
import { useState } from "react";

export interface FileBlobsContext {
  base: string | null;
  head: string | null;
}

export interface UseFileBlobsResult {
  context: FileBlobsContext | null;
  isPending: boolean;
  error: string | null;
  requested: boolean;
  request: () => void;
}

export function useFileBlobs(target: ReviewTarget, file: DiffFileContract): UseFileBlobsResult {
  const [requested, setRequested] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.reviewDiffFileBlobs(target, file.path, file.sha),
    queryFn: () => daemon.getDiffFileBlobs(target, file.path, file.sha),
    enabled: requested && !file.binary,
    retry: (count, error) => !(error instanceof DaemonRequestError) && count < 2,
  });

  const blobs = query.data ?? null;
  return {
    context: blobs === null ? null : { base: blobs.base_content, head: blobs.head_content },
    isPending: query.isLoading,
    error: query.error === null ? null : blobsErrorMessage(query.error),
    requested,
    request: () => setRequested(true),
  };
}
