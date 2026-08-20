import {
  getPullRequest,
  getReviewedFile,
  listReviewedFilesForSubject,
  type ReviewedFileRow,
} from "@otomat/db";
import type { SetReviewedFileRequest } from "@otomat/domain";

import { computeDiff } from "./diff.js";
import { reloadOrThrow } from "./reload.js";
import { driveReviewedFileSync, upsertReviewedMark } from "./reviewed-files.js";
import { pullRequestSubjectRef, resolveReviewSubject } from "./subject.js";
import { ensureReview } from "./surface.js";
import type { ReviewContext, ReviewSubject } from "./types.js";

/** Queued per mark: a check/uncheck burst on one file must reach GitHub in the order the reviewer made it. */
const deliveries = new Map<string, Promise<unknown>>();

function serialize<T>(markId: string, operation: () => Promise<T>): Promise<T> {
  const active = deliveries.get(markId);
  const started: Promise<T> = (active ? active.then(operation, operation) : operation()).finally(
    () => {
      if (deliveries.get(markId) === started) deliveries.delete(markId);
    },
  );
  deliveries.set(markId, started);
  return started;
}

export function deliverReviewedFile(
  ctx: ReviewContext,
  subject: ReviewSubject,
  mark: ReviewedFileRow,
): Promise<ReviewedFileRow> {
  const pullRequest = subject.pullRequest();
  if (pullRequest === null || pullRequest.number === null) {
    return Promise.resolve(driveReviewedFileSync(ctx, mark, "local", { sync_error: null }));
  }
  return serialize(mark.id, async () => {
    const current = reloadOrThrow(
      () => getReviewedFile(ctx.db, mark.id),
      `reviewed file ${mark.id} vanished while synchronizing`,
    );
    const pending = driveReviewedFileSync(ctx, current, "pending", { sync_error: null });
    try {
      const viewerLogin = await ctx.syncViewedFile(pullRequest.id, {
        path: pending.file_path,
        viewed: pending.reviewed,
      });
      return driveReviewedFileSync(ctx, pending, "synced", {
        sync_error: null,
        viewer_login: viewerLogin,
      });
    } catch (error) {
      return driveReviewedFileSync(ctx, pending, "failed", {
        sync_error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

export function setReviewedFile(
  ctx: ReviewContext,
  subject: ReviewSubject,
  request: SetReviewedFileRequest,
): Promise<ReviewedFileRow> {
  const review = ensureReview(ctx, subject.id);
  const mark = upsertReviewedMark(ctx, review.id, {
    filePath: request.file_path,
    diffSha: request.diff_sha,
    reviewed: request.reviewed,
  });
  return deliverReviewedFile(ctx, subject, mark);
}

/** Idempotent, so every pull request command may re-run it; an unsynced local mark is intent GitHub has not seen yet. */
export async function importViewedFiles(ctx: ReviewContext, pullRequestId: string): Promise<void> {
  const pullRequest = getPullRequest(ctx.db, pullRequestId);
  if (!pullRequest || pullRequest.number === null || pullRequest.detached_at !== null) return;
  const subject = resolveReviewSubject(ctx, pullRequestSubjectRef(pullRequest));
  const diff = computeDiff(subject);
  if (diff === null) return;

  const remote = await ctx.readViewedFiles(pullRequestId);
  const viewedByPath = new Map(remote.files.map((file) => [file.path, file.viewed]));
  const localByPath = new Map(
    listReviewedFilesForSubject(ctx.db, subject.id).map((row) => [row.file_path, row]),
  );
  // Created on the first mark this pass writes, so a pull request with nothing to import opens no review.
  let reviewId: string | null = null;
  const owningReview = (): string => (reviewId ??= ensureReview(ctx, subject.id).id);

  for (const file of diff.files) {
    const existing = localByPath.get(file.path);
    const ours =
      existing !== undefined &&
      (existing.viewer_login === null || existing.viewer_login === remote.viewerLogin);
    if (ours && existing.sync_status !== "synced") {
      await deliverReviewedFile(ctx, subject, existing);
      continue;
    }
    const remoteViewed = viewedByPath.get(file.path);
    if (remoteViewed === undefined || (existing === undefined && !remoteViewed)) continue;
    const adopted = upsertReviewedMark(ctx, owningReview(), {
      filePath: file.path,
      diffSha: file.sha,
      reviewed: remoteViewed,
      viewerLogin: remote.viewerLogin,
    });
    driveReviewedFileSync(ctx, adopted, "synced", { sync_error: null });
  }
}
