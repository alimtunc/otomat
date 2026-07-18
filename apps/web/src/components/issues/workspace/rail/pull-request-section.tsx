import type { RunContract } from "@otomat/domain";
import { Button, Icon, PRStatusBadge } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRunPullRequest } from "@web/api/prs/queries";
import {
  RailMeta,
  RailRow,
  RailSection,
  Unknown,
} from "@web/components/issues/workspace/rail/rail-primitives";

export function PullRequestSection({ run }: { run: RunContract }) {
  const pr = useRunPullRequest(run.id);
  const pullRequest = pr.data?.pull_request ?? null;
  if (pullRequest === null) return null;
  return (
    <RailSection title="Pull request">
      <RailMeta>
        <RailRow label="Status">
          <PRStatusBadge status={pullRequest.status} />
        </RailRow>
        <RailRow label="Number">
          {pullRequest.number !== null ? (
            <span className="font-mono text-xs text-text-secondary">#{pullRequest.number}</span>
          ) : (
            <Unknown />
          )}
        </RailRow>
      </RailMeta>
      {pullRequest.url !== null ? (
        <a
          href={pullRequest.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-iris-text hover:underline"
        >
          Open on GitHub ↗
        </a>
      ) : (
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
      )}
    </RailSection>
  );
}
