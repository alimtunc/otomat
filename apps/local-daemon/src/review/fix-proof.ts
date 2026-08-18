import { getReviewComment, listAgentSessionsForRun, type ReviewCommentRow } from "@otomat/db";
import {
  narrowPatchToRange,
  type CommentFixProof,
  type DiffFileContract,
  type FixProofPass,
  type PatchRange,
} from "@otomat/domain";

import type { DiffFile } from "#git";

import { resolveScope } from "./scope.js";
import type { ReviewContext } from "./types.js";

function toDiffFile(file: DiffFile): DiffFileContract {
  return {
    path: file.path,
    old_path: file.oldPath,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    binary: file.binary,
    patch: file.patch,
    sha: file.sha,
  };
}

/** A head-side anchor of the reviewed diff is the old side of the fix pass's delta, so the selection is exact rather than guessed. */
function proofRange(comment: ReviewCommentRow): PatchRange | null {
  if (comment.side !== "new" || comment.line === null || comment.line < 1) return null;
  return { side: "old", startLine: comment.start_line ?? comment.line, endLine: comment.line };
}

function unavailable(reason: string): CommentFixProof {
  return { state: "unavailable", reason };
}

export function getCommentFixProof(
  ctx: ReviewContext,
  runId: string,
  commentId: string,
): CommentFixProof {
  const comment = getReviewComment(ctx.db, commentId);
  if (!comment) return unavailable("This comment is no longer recorded on the run.");
  if (comment.fixed_by_session_id === null) {
    return unavailable("No fix pass is recorded for this comment.");
  }

  const sessionId = comment.fixed_by_session_id;
  const session = listAgentSessionsForRun(ctx.db, runId).find((row) => row.id === sessionId);
  if (!session) return unavailable("The pass that addressed this comment is no longer recorded.");

  const resolved = resolveScope(
    ctx,
    { kind: "run", id: runId },
    { kind: "session", session: sessionId },
  );
  if (resolved.snapshot === null || resolved.scope.kind !== "session") {
    return unavailable(resolved.unavailable ?? "This pass has no reconstructable delta.");
  }

  const pass: FixProofPass = {
    agent_session_id: sessionId,
    step_name: resolved.scope.step_name,
  };

  const file = resolved.snapshot.diff.files.find((entry) => entry.path === comment.file_path);
  if (!file) {
    return { state: "no_change", pass, reason: `This pass did not change ${comment.file_path}.` };
  }

  const range = proofRange(comment);
  // A whole-file or base-side anchor names no lines to narrow to, so the file's own delta is the most precise attribution.
  if (range === null || file.binary || file.patch === "") {
    return {
      state: "reported",
      pass,
      file: toDiffFile(file),
      excerpt: file.patch,
      whole_file: true,
    };
  }

  const narrowed = narrowPatchToRange(file.patch, range);
  if (narrowed === null) {
    return {
      state: "no_change",
      pass,
      reason: `This pass changed ${comment.file_path}, but not the lines this comment anchors to.`,
    };
  }
  return { state: "reported", pass, file: toDiffFile(file), excerpt: narrowed, whole_file: false };
}
