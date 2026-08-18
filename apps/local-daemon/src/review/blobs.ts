import {
  DiffUnavailableError,
  FileNotExpandableError,
  FileNotInDiffError,
  FileTooLargeError,
  ReviewAnchorStaleError,
} from "./errors.js";
import type { FileBlobsRequest, FileBlobsResult, ReviewSubject } from "./types.js";

// Expanding context ships whole files over the loopback API; past this a file is
// refused outright rather than silently truncated into a lying "full file" view.
const MAX_BLOB_BYTES = 2 * 1024 * 1024;

export function getFileBlobs(subject: ReviewSubject, request: FileBlobsRequest): FileBlobsResult {
  const snapshot = subject.snapshot();
  if (snapshot === null) throw new DiffUnavailableError(subject.id);

  const file = snapshot.diff.files.find((candidate) => candidate.path === request.path);
  if (!file) throw new FileNotInDiffError(request.path);
  if (file.sha !== request.sha) throw new ReviewAnchorStaleError(request.path);
  if (file.binary) throw new FileNotExpandableError(request.path);

  const blobs = snapshot.fileBlobs({ path: file.path, oldPath: file.oldPath });
  const bytes = Buffer.byteLength(blobs.base ?? "") + Buffer.byteLength(blobs.head ?? "");
  if (bytes > MAX_BLOB_BYTES) throw new FileTooLargeError(file.path);
  return { base: blobs.base, head: blobs.head };
}
