import { ErrorState, Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useConnectGitHub, usePreparePullRequest } from "@web/api/reviews/mutations";
import { useGitHubConnection, useRunPullRequest } from "@web/api/reviews/queries";
import { useRunDetail } from "@web/api/runs/queries";
import { PullRequestForm } from "@web/components/runs/pr/form";
import { pullRequestAcceptedSubmission } from "@web/components/runs/pr/model";
import { CenteredState } from "@web/components/shell/centered-state";

export function RunPrView() {
  const { runId } = useParams({ from: "/runs/$runId/pr" });
  const runQuery = useRunDetail(runId);
  const prQuery = useRunPullRequest(runId);
  const connectionQuery = useGitHubConnection();
  const connect = useConnectGitHub();
  const prepare = usePreparePullRequest(runId);

  if (runQuery.isPending || prQuery.isPending || connectionQuery.isPending) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    );
  }
  if (runQuery.isError || prQuery.isError || connectionQuery.isError) {
    return (
      <CenteredState>
        <ErrorState
          title="Could not load GitHub publication state"
          description="The daemon did not answer. Check that it is running."
          onRetry={() => {
            void Promise.all([runQuery.refetch(), prQuery.refetch(), connectionQuery.refetch()]);
          }}
        />
      </CenteredState>
    );
  }

  const pullRequest = prQuery.data.pull_request;

  return (
    <div className="p-4">
      <PullRequestForm
        key={`${pullRequest?.id ?? "new"}:${pullRequest?.publication_status ?? "none"}:${pullRequest?.status ?? "none"}`}
        pullRequest={pullRequest}
        branch={runQuery.data.run.branch}
        connection={connectionQuery.data}
        onSubmit={async (value) => {
          try {
            const detail = await prepare.mutateAsync(value);
            return pullRequestAcceptedSubmission(detail.pull_request, value);
          } catch {
            return false;
          }
        }}
        onConnect={() => connect.mutate()}
        isPending={prepare.isPending}
        isConnecting={connect.isPending || connectionQuery.data.status === "connecting"}
        canPublish={runQuery.data.run.status === "review_ready"}
      />
    </div>
  );
}
