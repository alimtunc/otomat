import { isPullRequestLive, type PullRequestPublicationMode } from "@otomat/domain";
import { ErrorState, PRStatusBadge } from "@otomat/ui";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useIssue } from "@web/api/issues/queries";
import {
  useConnectGitHub,
  useGeneratePullRequestMetadata,
  usePublishPullRequest,
} from "@web/api/prs/mutations";
import { useGitHubConnection, useRunPullRequest } from "@web/api/prs/queries";
import { useRunDetail } from "@web/api/runs/queries";
import { PullRequestBlockerNotice } from "@web/components/runs/pr/blocker-notice";
import { PullRequestConnectionPanel } from "@web/components/runs/pr/connection-panel";
import { PullRequestExecutionNotice } from "@web/components/runs/pr/execution-notice";
import { PullRequestForm } from "@web/components/runs/pr/form";
import { PullRequestGeneratorNote } from "@web/components/runs/pr/generator-note";
import { initialPublicationMode, pullRequestConnectionModel } from "@web/components/runs/pr/model";
import { PullRequestOutcome } from "@web/components/runs/pr/outcome";
import { PullRequestProgress } from "@web/components/runs/pr/progress";
import { PullRequestSummary } from "@web/components/runs/pr/summary";
import { PullRequestSyncPanel } from "@web/components/runs/pr/sync/panel";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";

export function RunPrView() {
  const { runId } = useParams({ from: "/runs/$runId/pr" });
  const { customize, mode } = useSearch({ from: "/runs/$runId/pr" });
  const navigate = useNavigate({ from: "/runs/$runId/pr" });
  const runQuery = useRunDetail(runId);
  const prQuery = useRunPullRequest(runId);
  const connectionQuery = useGitHubConnection();
  const issueQuery = useIssue(runQuery.data?.run.issue_id ?? null);
  const connect = useConnectGitHub();
  const publish = usePublishPullRequest(runId);
  const generate = useGeneratePullRequestMetadata(runId);

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
  const { operation, publishability, sync } = prQuery.data;
  const issueTitle = issueQuery.data?.title ?? "Not loaded";

  if (pullRequest !== null && !isPullRequestLive(pullRequest.status)) {
    return (
      <div className="flex max-w-2xl flex-col gap-4 p-4">
        <PullRequestOutcome
          pullRequest={pullRequest}
          runId={runId}
          issueTitle={issueTitle}
          hasWorktree={runQuery.data.worktree_path !== null}
        />
      </div>
    );
  }

  const headRef = pullRequest?.head_ref ?? null;
  const connection = pullRequestConnectionModel(connectionQuery.data, pullRequest);

  return (
    <div className="flex max-w-2xl flex-col gap-4 p-4">
      <PullRequestExecutionNotice runId={runId} />
      {headRef !== null && sync !== null ? (
        <PullRequestSyncPanel runId={runId} headRef={headRef} sync={sync} />
      ) : null}
      {pullRequest ? <PRStatusBadge status={pullRequest.status} /> : null}
      <PullRequestSummary
        publishability={publishability}
        mode={initialPublicationMode(pullRequest, mode)}
        issueTitle={issueTitle}
      />
      <PullRequestBlockerNotice blocker={publishability.blocker} />
      <PullRequestConnectionPanel
        model={connection}
        onConnect={() => connect.mutate()}
        isConnecting={connect.isPending || connectionQuery.data.status === "connecting"}
      />
      <PullRequestProgress operation={operation} />
      <PullRequestGeneratorNote generator={pullRequest?.generator ?? null} />
      <PullRequestForm
        key={`${pullRequest?.id ?? "new"}:${pullRequest?.publication_status ?? "none"}:${pullRequest?.status ?? "none"}`}
        pullRequest={pullRequest}
        operation={operation}
        publishability={publishability}
        connected={connection.connected}
        customize={customize === true}
        onCustomizeChange={(next) => {
          void navigate({ search: (previous) => ({ ...previous, customize: next || undefined }) });
        }}
        chosenMode={mode}
        onModeChange={(next: PullRequestPublicationMode) => {
          void navigate({ search: (previous) => ({ ...previous, mode: next }) });
        }}
        onSubmit={async (request) => {
          try {
            await publish.mutateAsync(request);
            return true;
          } catch {
            return false;
          }
        }}
        onGenerate={async () => {
          try {
            return await generate.mutateAsync();
          } catch {
            return null;
          }
        }}
        isPending={publish.isPending}
        isGenerating={generate.isPending}
      />
    </div>
  );
}
