import { diffFileBlobsResponseSchema, type DiffFileBlobsResponse } from "@otomat/domain";
import type { Context, Env } from "hono";

import {
  DiffUnavailableError,
  FileNotExpandableError,
  FileNotInDiffError,
  FileTooLargeError,
  ReviewAnchorStaleError,
  type FileBlobsResult,
} from "#review";

export function toDiffFileBlobsResponse(result: FileBlobsResult): DiffFileBlobsResponse {
  return diffFileBlobsResponseSchema.parse({
    base_content: result.base,
    head_content: result.head,
  });
}

/** Maps each honest refusal to its code, or null when the error is a daemon fault worth a 500. */
export function diffFileBlobsErrorResponse<E extends Env>(
  c: Context<E>,
  error: unknown,
): Response | null {
  if (error instanceof DiffUnavailableError) return c.json({ error: "diff_unavailable" }, 409);
  if (error instanceof FileNotInDiffError) return c.json({ error: "file_not_in_diff" }, 404);
  if (error instanceof FileNotExpandableError) return c.json({ error: "file_not_expandable" }, 409);
  if (error instanceof ReviewAnchorStaleError) return c.json({ error: "blobs_anchor_stale" }, 409);
  if (error instanceof FileTooLargeError) return c.json({ error: "file_too_large" }, 413);
  return null;
}
