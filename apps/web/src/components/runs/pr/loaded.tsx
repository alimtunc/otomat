import {
  isPullRequestLive,
  type GitHubConnectionContract,
  type PullRequestDetail,
  type PullRequestPublicationMode,
  type RunDetail,
} from "@otomat/domain";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useIssue } from "@web/api/issues/queries";
import {
  useConnectGitHub,
  useGeneratePullRequestMetadata,
  usePublishPullRequest,
} from "@web/api/prs/mutations";
import { useRunWorkspace } from "@web/api/runs/queries";
import { PullRequestBlockerNotice } from "@web/components/runs/pr/blocker-notice";
import { PullRequestConnectionPanel } from "@web/components/runs/pr/connection-panel";
import { PullRequestExecutionNotice } from "@web/components/runs/pr/execution-notice";
import { PullRequestForm } from "@web/components/runs/pr/form";
import { PullRequestGeneratorNote } from "@web/components/runs/pr/generator-note";
import { pullRequestConnectionModel } from "@web/components/runs/pr/model";
import { PullRequestOutcome } from "@web/components/runs/pr/outcome";
import { PullRequestProgress } from "@web/components/runs/pr/progress";
import { PullRequestSyncPanel } from "@web/components/runs/pr/sync/panel";
import { pullRequestGenerationRefusal } from "@web/lib/pull-request/generation-refusal";

export interface RunPrLoadedProps {
  runId: string;
  run: RunDetail;
  publication: PullRequestDetail;
  connection: GitHubConnectionContract;
}

export function RunPrLoaded({ runId, run, publication, connection }: RunPrLoadedProps) {
  const { customize, mode } = useSearch({ from: "/runs/$runId/pr" });
  const navigate = useNavigate({ from: "/runs/$runId/pr" });
  const { pull_request: pullRequest, operation, publishability, sync } = publication;
  const workspace = useRunWorkspace(
    runId,
    pullRequest !== null && !isPullRequestLive(pullRequest.status),
  );
  const issueQuery = useIssue(run.run.issue_id ?? null);
  const connect = useConnectGitHub();
  const publish = usePublishPullRequest(runId);
  const generate = useGeneratePullRequestMetadata(runId);

  if (pullRequest !== null && !isPullRequestLive(pullRequest.status)) {
    return (
      <div className="flex max-w-2xl flex-col gap-4 p-4">
        <PullRequestOutcome
          pullRequest={pullRequest}
          runId={runId}
          issueTitle={issueQuery.data?.title ?? "Not loaded"}
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
  const connectionModel = pullRequestConnectionModel(connection, pullRequest);
  const generationRefusal = pullRequestGenerationRefusal(generate.error, pullRequest);

  return (
    <div className="flex max-w-2xl flex-col gap-4 p-4">
      <PullRequestBlockerNotice
        blocker={publishability.blocker}
        runId={runId}
        issueId={run.run.issue_id}
      />
      <PullRequestExecutionNotice runId={runId} />
      {headRef !== null && sync !== null ? (
        <PullRequestSyncPanel runId={runId} headRef={headRef} sync={sync} />
      ) : null}
      {connectionModel.connected &&
      (connectionModel.errorMessage === null || generationRefusal !== null) &&
      connectionModel.linkUrl === null ? null : (
        <PullRequestConnectionPanel
          model={
            generationRefusal === null
              ? connectionModel
              : { ...connectionModel, errorMessage: null }
          }
          onConnect={() => connect.mutate()}
          isConnecting={connect.isPending || connection.status === "connecting"}
        />
      )}
      <PullRequestProgress operation={operation} />
      <PullRequestGeneratorNote generator={pullRequest?.generator ?? null} />
      <PullRequestForm
        key={`${pullRequest?.id ?? "new"}:${pullRequest?.publication_status ?? "none"}:${pullRequest?.status ?? "none"}`}
        pullRequest={pullRequest}
        operation={operation}
        publishability={publishability}
        connected={connectionModel.connected}
        connectionLabel={connectionModel.connectionLabel}
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
}
