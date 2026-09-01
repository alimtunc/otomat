import type { PullRequestContract } from "@otomat/domain";
import {
  Button,
  Chip,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  MetaList,
  PRStatusBadge,
  RelativeTime,
  StatusGlyph,
  type MetaListItem,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { PullRequestGeneratorNote } from "@web/components/runs/pr/generator-note";

export interface PullRequestOutcomeProps {
  pullRequest: PullRequestContract;
  runId: string;
  issueTitle: string;
  hasWorktree: boolean;
}

export function PullRequestOutcome({
  pullRequest,
  runId,
  issueTitle,
  hasWorktree,
}: PullRequestOutcomeProps) {
  const name =
    pullRequest.number === null ? "Pull request" : `Pull request #${String(pullRequest.number)}`;
  const items: MetaListItem[] = [
    { key: "issue", label: "Issue", value: <span className="truncate">{issueTitle}</span> },
    {
      key: "branches",
      label: "Branches",
      value: (
        <span className="font-mono text-xs text-text-secondary">
          {pullRequest.head_ref ?? "unknown"} → {pullRequest.base_ref ?? "unknown"}
        </span>
      ),
    },
    {
      key: "author",
      label: "Author",
      value: (
        <span className="text-text-secondary">{pullRequest.author_login ?? "not reported"}</span>
      ),
    },
    {
      key: "updated",
      label: pullRequest.status === "merged" ? "Merged" : "Closed",
      value:
        pullRequest.provider_updated_at === null ? (
          <span className="text-text-tertiary">not reported</span>
        ) : (
          <RelativeTime date={pullRequest.provider_updated_at} />
        ),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
        <div className="flex items-center gap-2.5">
          <StatusGlyph kind="pr" status={pullRequest.status} className="size-5" />
          <h2 className="text-sm font-semibold">{name}</h2>
          <PRStatusBadge status={pullRequest.status} />
        </div>
        <p className="mt-1.5 text-sm text-text-secondary">{pullRequest.title}</p>
        <div className="mt-3.5">
          <MetaList items={items} />
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {pullRequest.url === null ? null : (
            <Button
              size="sm"
              render={
                <a
                  href={pullRequest.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open on GitHub — ${name.toLowerCase()}`}
                />
              }
            >
              Open on GitHub
            </Button>
          )}
          {hasWorktree ? (
            <Button
              size="sm"
              variant="ghost"
              render={<Link to="/runs/$runId/diff" params={{ runId }} />}
            >
              View diff
            </Button>
          ) : (
            <p className="text-xs text-text-tertiary">
              The run's worktree was removed — there is no local diff to show.
            </p>
          )}
        </div>
      </div>
      <PullRequestOutcomeDetails pullRequest={pullRequest} />
    </div>
  );
}

function PullRequestOutcomeDetails({ pullRequest }: { pullRequest: PullRequestContract }) {
  return (
    <Collapsible>
      <CollapsibleTrigger
        render={
          <Button type="button" variant="ghost" size="sm">
            Publication details
          </Button>
        }
      />
      <CollapsiblePanel className="flex flex-col gap-2.5 pt-2.5">
        {pullRequest.commit_subject === null ? null : (
          <Chip tone="ghost" className="self-start font-mono">
            {pullRequest.commit_subject}
          </Chip>
        )}
        {pullRequest.body === null || pullRequest.body === "" ? (
          <p className="text-xs text-text-tertiary">No description was published.</p>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-text-secondary">{pullRequest.body}</p>
        )}
        <PullRequestGeneratorNote generator={pullRequest.generator} />
      </CollapsiblePanel>
    </Collapsible>
  );
}
