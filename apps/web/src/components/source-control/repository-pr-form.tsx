import type { SourceControlResponse } from "@otomat/domain";
import { ErrorState, Spinner, toast } from "@otomat/ui";
import { useNavigate } from "@tanstack/react-router";
import { useConnectGitHub } from "@web/api/prs/mutations";
import { useGitHubConnection } from "@web/api/prs/queries";
import {
  useGenerateRepositoryPullRequest,
  usePublishRepositoryPullRequest,
} from "@web/api/source-control/publication";
import { useRepositoryPullRequestPreview } from "@web/api/source-control/queries";
import { PullRequestConnectionPanel } from "@web/components/runs/pr/connection-panel";
import { PullRequestForm } from "@web/components/runs/pr/form";
import { PullRequestGeneratorNote } from "@web/components/runs/pr/generator-note";
import { pullRequestConnectionModel } from "@web/components/runs/pr/model";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { sourceControlMessage } from "@web/components/source-control/refusal";
import { useState } from "react";

export interface RepositoryPullRequestFormProps {
  repositoryId: string;
  changes: SourceControlResponse;
  baseRef: string;
  onPublished: () => void;
  onBusyChange: (busy: boolean) => void;
}

export function RepositoryPullRequestForm({
  repositoryId,
  changes,
  baseRef,
  onPublished,
  onBusyChange,
}: RepositoryPullRequestFormProps) {
  const preview = useRepositoryPullRequestPreview(repositoryId, baseRef, changes.revision);
  const connection = useGitHubConnection();
  const connect = useConnectGitHub();
  const publish = usePublishRepositoryPullRequest(repositoryId);
  const generate = useGenerateRepositoryPullRequest(repositoryId);
  const [customize, setCustomize] = useState(false);
  const navigate = useNavigate();
  const error = generate.error ?? publish.error;
  return (
    <QueryBoundary
      query={connection}
      pending={
        <CenteredState fill="flex">
          <Spinner label="Checking GitHub connection" />
        </CenteredState>
      }
      error={
        <ErrorState
          title="Could not load GitHub connection"
          onRetry={() => void connection.refetch()}
        />
      }
    >
      {(connected) => {
        const model = pullRequestConnectionModel(connected, null);
        return (
          <>
            {model.connected ? null : (
              <PullRequestConnectionPanel
                model={model}
                onConnect={() => connect.mutate()}
                isConnecting={connect.isPending || connected.status === "connecting"}
              />
            )}
            <QueryBoundary
              query={preview}
              pending={
                <CenteredState fill="flex">
                  <Spinner label="Preparing pull request" />
                </CenteredState>
              }
              error={
                <ErrorState
                  title="Could not prepare pull request"
                  description={sourceControlMessage(preview.error)}
                  onRetry={() => void preview.refetch()}
                />
              }
            >
              {(data) => (
                <>
                  {data.publishability.blocker === null ? null : (
                    <p role="alert" className="text-sm text-warning">
                      {data.publishability.blocker.message}
                    </p>
                  )}
                  {error === null ? null : (
                    <p role="alert" className="text-sm text-danger">
                      {sourceControlMessage(error)}
                    </p>
                  )}
                  <PullRequestGeneratorNote generator={generate.data?.generator ?? null} />
                  <PullRequestForm
                    pullRequest={null}
                    operation={null}
                    publishability={data.publishability}
                    connected={model.connected && !preview.isError && !connection.isError}
                    connectionLabel={model.connectionLabel}
                    customize={customize}
                    onCustomizeChange={setCustomize}
                    chosenMode={undefined}
                    onSubmit={async (request) => {
                      onBusyChange(true);
                      try {
                        const pullRequest = await publish.mutateAsync({
                          ...request,
                          revision: data.revision,
                          base_ref: baseRef,
                        });
                        toast.success(`Pull request #${pullRequest.number} published`);
                        onPublished();
                        void navigate({
                          to: "/pull-requests/$pullRequestId/diff",
                          params: { pullRequestId: pullRequest.id },
                        });
                        return true;
                      } catch (failure) {
                        toast.error(sourceControlMessage(failure));
                        return false;
                      } finally {
                        onBusyChange(false);
                      }
                    }}
                    onGenerate={async () => {
                      onBusyChange(true);
                      try {
                        return await generate.mutateAsync({
                          revision: data.revision,
                          base_ref: baseRef,
                        });
                      } catch (failure) {
                        toast.error(sourceControlMessage(failure));
                        return null;
                      } finally {
                        onBusyChange(false);
                      }
                    }}
                    generationRefusal={error === null ? null : sourceControlMessage(error)}
                    isPending={publish.isPending}
                    isGenerating={generate.isPending}
                  />
                </>
              )}
            </QueryBoundary>
          </>
        );
      }}
    </QueryBoundary>
  );
}
