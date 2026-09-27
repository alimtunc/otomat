import type { PullRequestContract } from "@otomat/domain";
import { Button, Chip, FOCUS_RING, PRStatusBadge } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRefreshPullRequest } from "@web/api/prs/mutations";
import { DetachPullRequestDialog } from "@web/components/pull-requests/detach-dialog";
import { PullRequestStackSection } from "@web/components/pull-requests/stack-section";
import {
  PULL_REQUEST_PROVENANCE_LABEL,
  PULL_REQUEST_PROVENANCE_TONE,
} from "@web/lib/pull-request/provenance";
import { useState } from "react";

export interface AttachedPullRequestCardProps {
  issueId: string;
  pullRequest: PullRequestContract;
}

export function AttachedPullRequestCard({ issueId, pullRequest }: AttachedPullRequestCardProps) {
  const refresh = useRefreshPullRequest(pullRequest.id, issueId);
  const [detaching, setDetaching] = useState(false);
  const settled = pullRequest.status === "merged" || pullRequest.status === "closed";

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-2 p-2.5">
      <div className="space-y-2">
        {pullRequest.url === null ? (
          <span className="block break-words text-sm font-medium leading-relaxed text-foreground">
            #{pullRequest.number} {pullRequest.title}
          </span>
        ) : (
          <a
            href={pullRequest.url}
            target="_blank"
            rel="noreferrer"
            className={`block rounded-sm break-words text-sm font-medium leading-relaxed text-foreground hover:underline ${FOCUS_RING}`}
          >
            #{pullRequest.number} {pullRequest.title}
          </a>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <PRStatusBadge status={pullRequest.status} />
          <Chip tone={PULL_REQUEST_PROVENANCE_TONE[pullRequest.provenance]}>
            {PULL_REQUEST_PROVENANCE_LABEL[pullRequest.provenance]}
          </Chip>
        </div>
      </div>
      <p
        title={`${pullRequest.head_ref} → ${pullRequest.base_ref}`}
        className="m-0 truncate font-mono text-xs text-text-tertiary"
      >
        {pullRequest.head_ref} → {pullRequest.base_ref}
        {pullRequest.head_sha === null ? "" : ` @ ${pullRequest.head_sha.slice(0, 7)}`}
      </p>
      <div className="flex items-center gap-1.5">
        {settled ? (
          <span className="flex-1 text-xs text-text-tertiary">
            GitHub confirmed it {pullRequest.status}; it left the active reviews.
          </span>
        ) : (
          <Button
            size="xs"
            variant="outline"
            className="flex-1"
            render={
              <Link
                to="/pull-requests/$pullRequestId/diff"
                params={{ pullRequestId: pullRequest.id }}
              />
            }
          >
            Review diff
          </Button>
        )}
        <Button
          size="xs"
          variant="ghost"
          loading={refresh.isPending}
          onClick={() => refresh.mutate({ announce: true })}
        >
          Refresh
        </Button>
        {pullRequest.origin === "imported" ? (
          <Button size="xs" variant="ghost" onClick={() => setDetaching(true)}>
            Remove
          </Button>
        ) : null}
      </div>
      {pullRequest.number === null ? null : (
        <PullRequestStackSection pullRequestId={pullRequest.id} />
      )}
      <DetachPullRequestDialog
        issueId={issueId}
        pullRequest={pullRequest}
        open={detaching}
        onOpenChange={setDetaching}
      />
    </div>
  );
}
