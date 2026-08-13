import { ErrorState } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import {
  useConnectGitHub,
  useDraftPullRequest,
  usePreparePullRequest,
} from "@web/api/prs/mutations";
import { useGitHubConnection, useRunPullRequest } from "@web/api/prs/queries";
import { useRunDetail } from "@web/api/runs/queries";
import { PullRequestForm } from "@web/components/runs/pr/form";
import { pullRequestAcceptedSubmission } from "@web/components/runs/pr/model";
import { PullRequestSyncPanel } from "@web/components/runs/pr/sync/panel";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";

export function RunPrView() {
  const { runId } = useParams({ from: "/runs/$runId/pr" });
  const runQuery = useRunDetail(runId);
  const prQuery = useRunPullRequest(runId);
  const connectionQuery = useGitHubConnection();
  const connect = useConnectGitHub();
  const prepare = usePreparePullRequest(runId);
  const draft = useDraftPullRequest(runId);

  if (runQuery.isPending || prQuery.isPending || connectionQuery.isPending) {
    return <DetailSkeleton blockClassName="h-40 w-full max-w-2xl" />;
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
  const sync = prQuery.data.sync;
  const headRef = pullRequest?.head_ref ?? null;

  return (
    <div className="flex max-w-2xl flex-col gap-4 p-4">
      {headRef !== null && sync !== null ? (
        <PullRequestSyncPanel runId={runId} headRef={headRef} sync={sync} />
      ) : null}
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
        onDraft={async () => {
          try {
            return await draft.mutateAsync();
          } catch {
            return null;
          }
        }}
        onConnect={() => connect.mutate()}
        isPending={prepare.isPending}
        isDrafting={draft.isPending}
        isConnecting={connect.isPending || connectionQuery.data.status === "connecting"}
        canPublish={runQuery.data.run.status === "review_ready"}
      />
    </div>
  );
}
