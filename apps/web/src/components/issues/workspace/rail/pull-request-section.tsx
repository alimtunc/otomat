import type { RunContract } from "@otomat/domain";
import { Button, Icon, PRStatusBadge } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRunPullRequest } from "@web/api/prs/queries";
import {
  RailMeta,
  RailRow,
  RailSection,
} from "@web/components/issues/workspace/rail/rail-primitives";

export function PullRequestSection({ run }: { run: RunContract }) {
  const pr = useRunPullRequest(run.id);
  const pullRequest = pr.data?.pull_request ?? null;
  if (pullRequest === null || pullRequest.number !== null) return null;
  return (
    <RailSection title="Pull request">
      <RailMeta>
        <RailRow label="Status">
          <PRStatusBadge status={pullRequest.status} />
        </RailRow>
      </RailMeta>
      <Button
        size="sm"
        className="mt-2.5 w-full"
        render={
          <Link to="/runs/$runId/pr" params={{ runId: run.id }}>
            <Icon name="git-pull-request" aria-hidden />
            Pull request details
          </Link>
        }
      />
    </RailSection>
  );
}
