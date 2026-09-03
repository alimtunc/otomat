import { DaemonRequestError } from "@otomat/client";
import {
  diffMediaTypeForPath,
  type DiffFileBlob,
  type DiffFileBlobsResponse,
  type DiffFileContract,
  type ReviewTarget,
  type RunDiffScopeSelector,
} from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";
import { blobsErrorMessage } from "@web/components/runs/diff/files/blobs-error";
import { useMemo, useState } from "react";

export interface FileBlobsContext {
  base: string | null;
  head: string | null;
}

type MediaBlob = Extract<DiffFileBlob, { kind: "media" }>;

export interface FileMediaContext {
  base: MediaBlob | null;
  head: MediaBlob | null;
}

export interface UseFileBlobsResult {
  context: FileBlobsContext | null;
  media: FileMediaContext | null;
  isPending: boolean;
  error: string | null;
  requested: boolean;
  /** Latched, so folding the file back and expanding it again never issues a second request. */
  request: () => void;
  retry: () => void;
}

function textContext(blobs: DiffFileBlobsResponse | null): FileBlobsContext | null {
  if (blobs === null || blobs.base?.kind === "media" || blobs.head?.kind === "media") return null;
  return { base: blobs.base?.content ?? null, head: blobs.head?.content ?? null };
}

function mediaContext(blobs: DiffFileBlobsResponse | null): FileMediaContext | null {
  if (blobs === null || blobs.base?.kind === "text" || blobs.head?.kind === "text") return null;
  if (blobs.base === null && blobs.head === null) return null;
  return { base: blobs.base, head: blobs.head };
}

/** `scope` must be the scope the patch came from: expanded context read from another pair of trees would not be this file. */
export function useFileBlobs(
  target: ReviewTarget,
  file: DiffFileContract,
  scope: RunDiffScopeSelector,
  autoload = false,
): UseFileBlobsResult {
  const keys = useQueryKeys();
  const [requested, setRequested] = useState(false);
  const mediaSupported =
    diffMediaTypeForPath(file.path) !== null ||
    (file.old_path !== null && diffMediaTypeForPath(file.old_path) !== null);
  const query = useQuery({
    queryKey: keys.reviewDiffFileBlobs(target, file.path, file.sha, scope),
    queryFn: () => daemon.getDiffFileBlobs(target, file.path, file.sha, scope),
    enabled: (requested && !file.binary) || (autoload && file.binary && mediaSupported),
    retry: (count, error) => !(error instanceof DaemonRequestError) && count < 2,
  });

  const blobs = query.data ?? null;
  const context = useMemo(() => textContext(blobs), [blobs]);
  const media = useMemo(() => mediaContext(blobs), [blobs]);

  return {
    context,
    media,
    isPending: query.isLoading,
    error: query.error === null ? null : blobsErrorMessage(query.error),
    requested,
    request: () => setRequested(true),
    retry: () => void query.refetch(),
  };
}
