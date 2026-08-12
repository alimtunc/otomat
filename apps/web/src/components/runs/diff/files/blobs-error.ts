import { DaemonRequestError } from "@otomat/client";
import { diffFileBlobsErrorSchema, type DiffFileBlobsError } from "@otomat/domain";

const MESSAGES: Record<DiffFileBlobsError, string> = {
  diff_unavailable: "This run has no worktree left to read the file from.",
  file_not_in_diff: "This file is no longer part of the diff.",
  file_not_expandable: "Binary files carry no context to expand.",
  blobs_anchor_stale: "The diff moved — refresh to expand this file again.",
  file_too_large: "This file is too large to load in full.",
};

/** Names the refusal the daemon gave, so a failed expand is stated instead of silently doing nothing. */
export function blobsErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = diffFileBlobsErrorSchema.safeParse(error.body);
    if (refusal.success) return MESSAGES[refusal.data.error];
  }
  return "Could not load this file's context — is the daemon running?";
}
