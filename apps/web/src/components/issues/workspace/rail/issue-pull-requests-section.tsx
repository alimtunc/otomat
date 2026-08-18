import { Skeleton } from "@otomat/ui";
import { useIssuePullRequests } from "@web/api/prs/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { RailSection } from "@web/components/issues/workspace/rail/rail-primitives";
import { AttachPullRequestForm } from "@web/components/pull-requests/attach-form";
import { AttachedPullRequestCard } from "@web/components/pull-requests/attached-card";
import { PullRequestCandidateRow } from "@web/components/pull-requests/candidate-row";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function IssuePullRequestsSection({ issueId }: { issueId: string }) {
  const query = useIssuePullRequests(issueId);

  return (
    <RailSection title="Pull requests">
      <QueryBoundary
        query={query}
        pending={<Skeleton height={64} />}
        error={
          <ErrorReport
            error={query.error}
            context="Couldn’t read this issue’s pull requests"
            onRetry={() => void query.refetch()}
          />
        }
      >
        {(data) => (
          <div className="flex flex-col gap-2">
            {data.attached.map((pullRequest) => (
              <AttachedPullRequestCard
                key={pullRequest.id}
                issueId={issueId}
                pullRequest={pullRequest}
              />
            ))}
            {data.candidates
              .filter((candidate) => candidate.attached_pull_request_id === null)
              .map((candidate) => (
                <PullRequestCandidateRow
                  key={candidate.evidence.number}
                  issueId={issueId}
                  candidate={candidate}
                />
              ))}
            <p className="m-0 text-xs text-text-tertiary">{data.detection.message}</p>
            <AttachPullRequestForm issueId={issueId} />
          </div>
        )}
      </QueryBoundary>
    </RailSection>
  );
}
