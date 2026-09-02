import { DaemonRequestError } from "@otomat/client";
import {
  agentProfileErrorSchema,
  reviewCommentErrorSchema,
  runStepAppendErrorSchema,
  type CreateReviewCommentRequest,
  type RequestFixRequest,
  type ReviewCommentContract,
  type ReviewDetail,
  type ReviewedFileContract,
  type ReviewTarget,
  type SetReviewedFileRequest,
  type SubmitReviewRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import type { HostQueryKeys } from "@web/api/query-keys";
import { seedIssueRun } from "@web/api/runs/seed/run";
import { useQueryKeys } from "@web/api/use-query-keys";

function reviewRefusal(error: unknown): string | null {
  if (!(error instanceof DaemonRequestError)) return null;
  const refusal = reviewCommentErrorSchema.safeParse(error.body);
  return refusal.success ? refusal.data.message : null;
}

function seedComment(
  client: QueryClient,
  keys: HostQueryKeys,
  target: ReviewTarget,
  comment: ReviewCommentContract,
): void {
  client.setQueryData(keys.reviewDetail(target), (current: ReviewDetail | undefined) => {
    if (current === undefined) return current;
    const known = current.comments.some((row) => row.id === comment.id);
    return {
      ...current,
      comments: known
        ? current.comments.map((row) => (row.id === comment.id ? comment : row))
        : [...current.comments, comment],
    };
  });
  client.invalidateQueries({ queryKey: keys.reviewDetail(target) });
}

function seedReviewedFile(
  client: QueryClient,
  keys: HostQueryKeys,
  target: ReviewTarget,
  mark: ReviewedFileContract,
): void {
  client.setQueryData(keys.reviewDetail(target), (current: ReviewDetail | undefined) => {
    if (current === undefined) return current;
    const known = current.reviewed_files.some((row) => row.file_path === mark.file_path);
    return {
      ...current,
      reviewed_files: known
        ? current.reviewed_files.map((row) => (row.file_path === mark.file_path ? mark : row))
        : [...current.reviewed_files, mark],
    };
  });
  client.invalidateQueries({ queryKey: keys.reviewDetail(target) });
}

export function useSetReviewedFile(target: ReviewTarget) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: SetReviewedFileRequest) => daemon.setReviewedFile(target, request),
    onSuccess: (mark) => seedReviewedFile(client, keys, target, mark),
    onError: () => {
      client.invalidateQueries({ queryKey: keys.reviewDetail(target) });
      toast.error("Could not record this file as reviewed — is the daemon running?");
    },
  });
}

function commentErrorMessage(error: unknown): string {
  const refusal = reviewRefusal(error);
  if (refusal !== null) return refusal;
  if (error instanceof DaemonRequestError && error.status === 409) {
    return "The diff changed under this comment — it was refreshed, please re-anchor.";
  }
  return "Could not add the comment — is the daemon running?";
}

export function useAddReviewComment(target: ReviewTarget) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: CreateReviewCommentRequest) => daemon.addReviewComment(target, request),
    onSuccess: (comment) => seedComment(client, keys, target, comment),
    onError: (error) => {
      if (error instanceof DaemonRequestError && error.status === 409) {
        client.invalidateQueries({ queryKey: keys.reviewDiff(target) });
      }
      toast.error(commentErrorMessage(error));
    },
  });
}

/** The daemon answers the whole surface, so one response seeds the detail, its comments and the counters. */
export function useSubmitReview(target: ReviewTarget) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: SubmitReviewRequest) => daemon.submitReview(target, request),
    onSuccess: (detail) => {
      client.setQueryData(keys.reviewDetail(target), detail);
      client.invalidateQueries({ queryKey: keys.reviewDetail(target) });
      if (target.kind === "pull_request") {
        client.invalidateQueries({ queryKey: keys.pullRequest(target.id) });
      }
      client.invalidateQueries({ queryKey: keys.reviews });
      client.invalidateQueries({ queryKey: keys.activity });
      toast.success("Review submitted on GitHub");
    },
    onError: (error) => {
      client.invalidateQueries({ queryKey: keys.reviewDetail(target) });
      toast.error(reviewRefusal(error) ?? "Could not submit the review — is the daemon running?");
    },
  });
}

function fixErrorMessage(error: unknown): string {
  const notFixable = reviewRefusal(error);
  if (notFixable !== null) return notFixable;
  if (error instanceof DaemonRequestError) {
    const refusal = runStepAppendErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    const profile = agentProfileErrorSchema.safeParse(error.body);
    if (profile.success) return profile.data.message;
    if (error.status === 409) {
      return "Fix not added — this run cannot take a step right now.";
    }
  }
  return "Could not request the fix — is the daemon running?";
}

export function useRequestFix(runId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: RequestFixRequest) => daemon.requestFix(runId, request),
    onSuccess: (response) => {
      seedIssueRun(client, keys, response.run);
      client.invalidateQueries({ queryKey: keys.run(runId) });
      client.invalidateQueries({ queryKey: keys.reviewDetail({ kind: "run", id: runId }) });
      client.invalidateQueries({ queryKey: keys.issues });
      toast.success("Fix step added to this issue's workspace");
    },
    onError: (error) => toast.error(fixErrorMessage(error)),
  });
}
