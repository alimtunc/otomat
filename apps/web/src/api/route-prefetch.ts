import { issueOptions } from "@web/api/issues/queries";
import { pullRequestReviewContextOptions } from "@web/api/prs/queries";
import { queryClient } from "@web/api/query-client";
import { hostKeys } from "@web/api/query-keys";
import { runEventWindowOptions, stepEventWindowOptions } from "@web/api/runs/event-window";
import { runDetailOptions, runsForIssueOptions } from "@web/api/runs/queries";
import { activeExecutionHostId } from "@web/lib/active-host";
import { resolveFollowedRun } from "@web/lib/run/activity";

// Each returns void: a loader that returned the promise would hold the navigation until it settled.

export function prefetchRun(runId: string): void {
  const keys = hostKeys(activeExecutionHostId());
  const detail = runDetailOptions(keys, runId);
  void queryClient.prefetchInfiniteQuery(runEventWindowOptions(keys, runId));
  void queryClient.prefetchQuery(detail).then(() => {
    for (const step of queryClient.getQueryData(detail.queryKey)?.steps ?? []) {
      void queryClient.prefetchInfiniteQuery(stepEventWindowOptions(keys, runId, step.id));
    }
  });
}

export function prefetchIssue(issueId: string, selectedRunId: string | undefined): void {
  const keys = hostKeys(activeExecutionHostId());
  void queryClient.prefetchQuery(issueOptions(keys, issueId));
  const runs = runsForIssueOptions(keys, issueId);
  void queryClient.prefetchQuery(runs).then(() => {
    const loaded = queryClient.getQueryData(runs.queryKey) ?? [];
    const followed = resolveFollowedRun(loaded, selectedRunId ?? null);
    if (followed !== null) prefetchRun(followed.id);
  });
}

export function prefetchPullRequest(pullRequestId: string): void {
  const keys = hostKeys(activeExecutionHostId());
  void queryClient.prefetchQuery(pullRequestReviewContextOptions(keys, pullRequestId));
}
