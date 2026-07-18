import type { IssueContract, RunContract } from "@otomat/domain";
import {
  Button,
  CopyButton,
  Icon,
  IssueStatusChip,
  PRStatusBadge,
  RunStatusChip,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRunPullRequest } from "@web/api/prs/queries";
import { useRunReview } from "@web/api/reviews/queries";
import { useRunDetail, useRunDiff } from "@web/api/runs/queries";
import { useRunEventStream } from "@web/api/runs/run-events-provider";
import { shortId } from "@web/lib/ids";
import { formatCostUsd, formatTokenCount, latestReportedUsage } from "@web/lib/run-usage";
import type { ReactNode } from "react";

function RailSection({
  title,
  last = false,
  children,
}: {
  title: ReactNode;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={last ? "pb-3.5 pt-1.5" : "mb-3.5 border-b border-border-subtle pb-3.5 pt-1.5"}>
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
        {title}
      </div>
      {children}
    </div>
  );
}

function RailMeta({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.25 text-sm">
      {children}
    </dl>
  );
}

function RailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="m-0 inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden justify-self-end text-foreground">
        {children}
      </dd>
    </>
  );
}

/** Honest placeholder for a value the daemon/runtime did not provide. */
function Unknown() {
  return <span className="text-text-tertiary">—</span>;
}

function PullRequestSection({ run }: { run: RunContract }) {
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

function FollowedRunSection({ run }: { run: RunContract }) {
  const detail = useRunDetail(run.id);
  const diff = useRunDiff(run.id);
  const review = useRunReview(run.id);
  const diffSummary = diff.data?.diff ?? null;
  const worktreePath = detail.data?.worktree_path ?? null;
  const sessionCount = detail.data ? detail.data.sessions.length : null;
  const hasReview = (review.data?.review ?? null) !== null;
  return (
    <RailSection
      title={
        <>
          Run
          <span className="font-normal text-text-tertiary">· {shortId(run.id)}</span>
        </>
      }
    >
      <RailMeta>
        <RailRow label="Status">
          <RunStatusChip status={run.status} />
        </RailRow>
        <RailRow label="Branch">
          <span className="truncate font-mono text-xs text-text-secondary" title={run.branch}>
            {run.branch}
          </span>
          <CopyButton value={run.branch} />
        </RailRow>
        <RailRow label="Worktree">
          {worktreePath !== null ? (
            <span className="truncate font-mono text-xs text-text-secondary" title={worktreePath}>
              …/{worktreePath.split("/").at(-1)}
            </span>
          ) : (
            <Unknown />
          )}
        </RailRow>
        <RailRow label="Sessions">
          {sessionCount !== null ? (
            <span className="font-mono text-xs text-text-secondary">{sessionCount}</span>
          ) : (
            <Unknown />
          )}
        </RailRow>
        <RailRow label="Diff">
          {diffSummary !== null ? (
            <span className="font-mono text-xs">
              <span className="text-success">+{diffSummary.additions}</span>{" "}
              <span className="text-danger">−{diffSummary.deletions}</span>
            </span>
          ) : (
            <Unknown />
          )}
        </RailRow>
      </RailMeta>
      <div className="mt-2.5 flex flex-col gap-2">
        <Button
          size="sm"
          className="w-full"
          render={
            <Link to="/runs/$runId" params={{ runId: run.id }}>
              <Icon name="activity" aria-hidden />
              Open run cockpit
            </Link>
          }
        />
        {diffSummary !== null ? (
          <Button
            size="sm"
            className="w-full"
            render={
              <Link to="/runs/$runId/diff" params={{ runId: run.id }}>
                <Icon name="git-compare" aria-hidden />
                {hasReview ? "View diff & review" : "View diff"}
              </Link>
            }
          />
        ) : null}
      </div>
    </RailSection>
  );
}

function UsageSection() {
  const stream = useRunEventStream();
  const usage = latestReportedUsage(stream.events);
  return (
    <RailSection
      title={
        <>
          Usage
          <span className="font-normal text-text-tertiary">· last reported</span>
        </>
      }
      last
    >
      <RailMeta>
        <RailRow label="Model">
          {usage?.model != null ? (
            <span className="truncate font-mono text-xs text-text-secondary">{usage.model}</span>
          ) : (
            <Unknown />
          )}
        </RailRow>
        <RailRow label="Input">
          {usage?.inputTokens != null ? (
            <span className="font-mono text-xs tabular-nums text-text-secondary">
              {formatTokenCount(usage.inputTokens)}
            </span>
          ) : (
            <Unknown />
          )}
        </RailRow>
        <RailRow label="Output">
          {usage?.outputTokens != null ? (
            <span className="font-mono text-xs tabular-nums text-text-secondary">
              {formatTokenCount(usage.outputTokens)}
            </span>
          ) : (
            <Unknown />
          )}
        </RailRow>
        <RailRow label="Cost">
          {usage?.costUsd != null ? (
            <span className="font-mono text-xs tabular-nums text-text-secondary">
              {formatCostUsd(usage.costUsd)}
            </span>
          ) : (
            <Unknown />
          )}
        </RailRow>
      </RailMeta>
      <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
        Only what the runtime actually reported — nothing is estimated.
      </p>
    </RailSection>
  );
}

/**
 * Right rail of the issue workspace. The run-scoped sections read the followed
 * run and must render inside its RunEventsProvider; with no run the rail shows
 * only the issue's properties.
 */
export function WorkspaceRail({ issue, run }: { issue: IssueContract; run: RunContract | null }) {
  return (
    <aside className="min-w-0 overflow-auto border-t border-border-subtle p-4 lg:border-l lg:border-t-0">
      <RailSection title="Properties" last={run === null}>
        <RailMeta>
          <RailRow label="Status">
            <IssueStatusChip status={issue.status} />
          </RailRow>
          <RailRow label="Source">
            <span className="text-text-secondary">{issue.source}</span>
          </RailRow>
          <RailRow label="External id">
            {issue.source_external_id !== null ? (
              <span className="truncate font-mono text-xs text-text-secondary">
                {issue.source_external_id}
              </span>
            ) : (
              <Unknown />
            )}
          </RailRow>
        </RailMeta>
      </RailSection>
      {run !== null ? (
        <>
          <PullRequestSection run={run} />
          <FollowedRunSection run={run} />
          <UsageSection />
        </>
      ) : null}
    </aside>
  );
}
