import { isPullRequestLive, type PullRequestPublicationMode } from "@otomat/domain";
import { ErrorState } from "@otomat/ui";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useIssue } from "@web/api/issues/queries";
import {
  useConnectGitHub,
  useGeneratePullRequestMetadata,
  usePublishPullRequest,
} from "@web/api/prs/mutations";
import { useGitHubConnection, useRunPullRequest } from "@web/api/prs/queries";
import { useRunDetail, useRunWorkspace } from "@web/api/runs/queries";
import { PullRequestBlockerNotice } from "@web/components/runs/pr/blocker-notice";
import { PullRequestConnectionPanel } from "@web/components/runs/pr/connection-panel";
import { PullRequestExecutionNotice } from "@web/components/runs/pr/execution-notice";
import { PullRequestForm } from "@web/components/runs/pr/form";
import { PullRequestGeneratorNote } from "@web/components/runs/pr/generator-note";
import { pullRequestConnectionModel } from "@web/components/runs/pr/model";
import { PullRequestOutcome } from "@web/components/runs/pr/outcome";
import { PullRequestProgress } from "@web/components/runs/pr/progress";
import { PullRequestSyncPanel } from "@web/components/runs/pr/sync/panel";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { pullRequestGenerationRefusal } from "@web/lib/pull-request/generation-refusal";

export function RunPrView() {
  const { runId } = useParams({ from: "/runs/$runId/pr" });
  const { customize, mode } = useSearch({ from: "/runs/$runId/pr" });
  const navigate = useNavigate({ from: "/runs/$runId/pr" });
  const runQuery = useRunDetail(runId);
  const prQuery = useRunPullRequest(runId);
  const connectionQuery = useGitHubConnection();
  const workspace = useRunWorkspace(
    runId,
    prQuery.data?.pull_request != null && !isPullRequestLive(prQuery.data.pull_request.status),
  );
  const issueQuery = useIssue(runQuery.data?.run.issue_id ?? null);
  const connect = useConnectGitHub();
  const publish = usePublishPullRequest(runId);
  const generate = useGeneratePullRequestMetadata(runId);

  const pending = <DetailSkeleton blockClassName="h-40 w-full max-w-2xl" />;
  const error = (
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
  return (
    <QueryBoundary query={runQuery} pending={pending} error={error}>
      {(runData) => (
        <QueryBoundary query={prQuery} pending={pending} error={error}>
          {(prData) => (
            <QueryBoundary query={connectionQuery} pending={pending} error={error}>
              {(connectionData) => {
                const pullRequest = prData.pull_request;
                const { operation, publishability, sync } = prData;
                const issueTitle = issueQuery.data?.title ?? "Not loaded";

                if (pullRequest !== null && !isPullRequestLive(pullRequest.status)) {
                  return (
                    <div className="flex max-w-2xl flex-col gap-4 p-4">
                      <PullRequestOutcome
                        pullRequest={pullRequest}
                        runId={runId}
                        issueTitle={issueTitle}
                        hasWorktree={
                          workspace.data === undefined || workspace.isError
                            ? null
                            : workspace.data.worktree_path !== null
                        }
                      />
                    </div>
                  );
                }

                const headRef = pullRequest?.head_ref ?? null;
                const connection = pullRequestConnectionModel(connectionData, pullRequest);
                const generationRefusal = pullRequestGenerationRefusal(generate.error, pullRequest);

                return (
                  <div className="flex max-w-2xl flex-col gap-4 p-4">
                    <PullRequestBlockerNotice
                      blocker={publishability.blocker}
                      runId={runId}
                      issueId={runData.run.issue_id}
                    />
                    <PullRequestExecutionNotice runId={runId} />
                    {headRef !== null && sync !== null ? (
                      <PullRequestSyncPanel runId={runId} headRef={headRef} sync={sync} />
                    ) : null}
                    {connection.connected &&
                    (connection.errorMessage === null || generationRefusal !== null) &&
                    connection.linkUrl === null ? null : (
                      <PullRequestConnectionPanel
                        model={
                          generationRefusal === null
                            ? connection
                            : { ...connection, errorMessage: null }
                        }
                        onConnect={() => connect.mutate()}
                        isConnecting={connect.isPending || connectionData.status === "connecting"}
                      />
                    )}
                    <PullRequestProgress operation={operation} />
                    <PullRequestGeneratorNote generator={pullRequest?.generator ?? null} />
                    <PullRequestForm
                      key={`${pullRequest?.id ?? "new"}:${pullRequest?.publication_status ?? "none"}:${pullRequest?.status ?? "none"}`}
                      pullRequest={pullRequest}
                      operation={operation}
                      publishability={publishability}
                      connected={connection.connected}
                      connectionLabel={connection.connectionLabel}
                      customize={customize === true}
                      onCustomizeChange={(next) => {
                        void navigate({
                          search: (previous) => ({ ...previous, customize: next || undefined }),
                        });
                      }}
                      chosenMode={mode}
                      onModeChange={(next: PullRequestPublicationMode) => {
                        void navigate({ search: (previous) => ({ ...previous, mode: next }) });
                      }}
                      onSubmit={async (request) => {
                        try {
                          await publish.mutateAsync(request);
                          generate.reset();
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
                      generationRefusal={generationRefusal}
                      isPending={publish.isPending}
                      isGenerating={generate.isPending}
                    />
                  </div>
                );
              }}
            </QueryBoundary>
          )}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}
