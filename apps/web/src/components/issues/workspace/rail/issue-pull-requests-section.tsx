import {
  Button,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  Icon,
  Skeleton,
} from "@otomat/ui";
import { useIssuePullRequests } from "@web/api/prs/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { RailSection } from "@web/components/issues/workspace/rail/rail-primitives";
import { AttachPullRequestForm } from "@web/components/pull-requests/attach-form";
import { AttachedPullRequestCard } from "@web/components/pull-requests/attached-card";
import { PullRequestCandidateRow } from "@web/components/pull-requests/candidate-row";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { useRef, useState } from "react";

export function IssuePullRequestsSection({ issueId }: { issueId: string }) {
  const query = useIssuePullRequests(issueId);
  const [linking, setLinking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeForm = () => {
    setLinking(false);
    trigger.current?.focus();
  };

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
          <div className="flex min-w-0 flex-col gap-3">
            {data.attached.map((pullRequest) => (
              <AttachedPullRequestCard
                key={pullRequest.id}
                issueId={issueId}
                pullRequest={pullRequest}
              />
            ))}
            {data.attached.length === 0 ? (
              <div className="flex items-start gap-2.5 py-1">
                <Icon
                  name="git-pull-request"
                  className="mt-0.5 shrink-0 text-text-tertiary"
                  aria-hidden
                />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm text-text-secondary">No linked pull request</p>
                  <p className="text-xs text-text-tertiary">
                    Link an existing PR to review it here.
                  </p>
                </div>
              </div>
            ) : null}
            {data.detection.status === "unavailable" ? (
              <p className="text-xs text-warning">{data.detection.message}</p>
            ) : null}
            <Collapsible open={linking} onOpenChange={setLinking}>
              <CollapsibleTrigger
                ref={trigger}
                render={<Button variant="outline" size="sm" className="w-full justify-start" />}
              >
                <Icon name="plus" aria-hidden />
                {data.attached.length === 0 ? "Link a pull request" : "Link another pull request"}
                <Icon
                  name={linking ? "chevron-down" : "chevron-right"}
                  className="ml-auto"
                  aria-hidden
                />
              </CollapsibleTrigger>
              <CollapsiblePanel className="space-y-3 pt-3">
                {data.candidates
                  .filter((candidate) => candidate.attached_pull_request_id === null)
                  .map((candidate) => (
                    <PullRequestCandidateRow
                      key={candidate.evidence.number}
                      issueId={issueId}
                      candidate={candidate}
                    />
                  ))}
                <AttachPullRequestForm
                  issueId={issueId}
                  onLinked={closeForm}
                  onCancel={closeForm}
                />
              </CollapsiblePanel>
            </Collapsible>
          </div>
        )}
      </QueryBoundary>
    </RailSection>
  );
}
