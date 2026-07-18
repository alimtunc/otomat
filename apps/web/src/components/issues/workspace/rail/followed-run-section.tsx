import type { RunContract } from "@otomat/domain";
import { Button, CopyButton, Icon, RunStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRunReview } from "@web/api/reviews/queries";
import { useRunDetail, useRunDiff } from "@web/api/runs/queries";
import {
  RailMeta,
  RailRow,
  RailSection,
  Unknown,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { shortId } from "@web/lib/ids";

export function FollowedRunSection({ run }: { run: RunContract }) {
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
