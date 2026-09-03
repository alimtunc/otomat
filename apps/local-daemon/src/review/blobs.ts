import { diffMediaTypeForPath, type DiffMediaType } from "@otomat/domain";

import {
  DiffUnavailableError,
  FileNotExpandableError,
  FileNotInDiffError,
  FileTooLargeError,
  ReviewAnchorStaleError,
} from "./errors.js";
import { resolveScope } from "./scope.js";
import type {
  FileBlobResult,
  FileBlobsRequest,
  FileBlobsResult,
  ReviewContext,
  ReviewSubjectRef,
} from "./types.js";

const MAX_TEXT_BLOB_BYTES = 2 * 1024 * 1024;
const MAX_MEDIA_BLOB_BYTES = 25 * 1024 * 1024;

function textBlob(content: string | null): FileBlobResult | null {
  return content === null ? null : { kind: "text", content };
}

function mediaBlob(data: Buffer | null, mediaType: DiffMediaType | null): FileBlobResult | null {
  return data === null || mediaType === null ? null : { kind: "media", data, mediaType };
}

export function getFileBlobs(
  ctx: ReviewContext,
  ref: ReviewSubjectRef,
  request: FileBlobsRequest,
): FileBlobsResult {
  const { snapshot } = resolveScope(ctx, ref, request.scope);
  if (snapshot === null) throw new DiffUnavailableError(ref.id);

  const file = snapshot.diff.files.find((candidate) => candidate.path === request.path);
  if (!file) throw new FileNotInDiffError(request.path);
  if (file.sha !== request.sha) throw new ReviewAnchorStaleError(request.path);

  if (!file.binary) {
    const blobs = snapshot.fileBlobs({ path: file.path, oldPath: file.oldPath });
    const bytes = Buffer.byteLength(blobs.base ?? "") + Buffer.byteLength(blobs.head ?? "");
    if (bytes > MAX_TEXT_BLOB_BYTES) throw new FileTooLargeError(file.path);
    return { base: textBlob(blobs.base), head: textBlob(blobs.head) };
  }

  const baseType = file.status === "added" ? null : diffMediaTypeForPath(file.oldPath ?? file.path);
  const headType = file.status === "deleted" ? null : diffMediaTypeForPath(file.path);
  if (
    (file.status !== "added" && baseType === null) ||
    (file.status !== "deleted" && headType === null)
  ) {
    throw new FileNotExpandableError(request.path);
  }

  const blobs = snapshot.mediaBlobs({ path: file.path, oldPath: file.oldPath });
  const bytes = (blobs.base?.byteLength ?? 0) + (blobs.head?.byteLength ?? 0);
  if (bytes > MAX_MEDIA_BLOB_BYTES) throw new FileTooLargeError(file.path);
  return {
    base: mediaBlob(blobs.base, baseType),
    head: mediaBlob(blobs.head, headType),
  };
}
