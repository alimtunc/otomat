import { ErrorState, Spinner, toast } from "@otomat/ui";
import { useNavigate } from "@tanstack/react-router";
import type {
  useGenerateRepositoryPullRequest,
  usePublishRepositoryPullRequest,
} from "@web/api/prs/mutations";
import { useConnectGitHub } from "@web/api/prs/mutations";
import { useGitHubConnection, useRepositoryPullRequestPreview } from "@web/api/prs/queries";
import { PullRequestConnectionPanel } from "@web/components/runs/pr/connection-panel";
import { PullRequestForm } from "@web/components/runs/pr/form";
import { PullRequestGeneratorNote } from "@web/components/runs/pr/generator-note";
import { pullRequestConnectionModel } from "@web/components/runs/pr/model";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { sourceControlMessage } from "@web/components/source-control/refusal";
import { useState } from "react";

export interface RepositoryPullRequestPublicationProps {
  repositoryId: string;
  baseRef: string;
  revision: string;
  publish: Pick<
    ReturnType<typeof usePublishRepositoryPullRequest>,
    "mutateAsync" | "isPending" | "error"
  >;
  generate: Pick<
    ReturnType<typeof useGenerateRepositoryPullRequest>,
    "mutateAsync" | "isPending" | "error" | "data"
  >;
  onPublished: () => void;
}

export function RepositoryPullRequestPublication({
  repositoryId,
  baseRef,
  revision,
  publish,
  generate,
  onPublished,
}: RepositoryPullRequestPublicationProps) {
  const preview = useRepositoryPullRequestPreview(repositoryId, baseRef, revision);
  const connection = useGitHubConnection();
  const connect = useConnectGitHub();
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
                      } catch {
                        return false;
                      }
                    }}
                    onGenerate={async () => {
                      try {
                        return await generate.mutateAsync({
                          revision: data.revision,
                          base_ref: baseRef,
                        });
                      } catch {
                        return null;
                      }
                    }}
                    generationRefusal={
                      generate.error === null ? null : sourceControlMessage(generate.error)
                    }
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
