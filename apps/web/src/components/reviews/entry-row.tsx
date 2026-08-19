import type { PullRequestInboxEntry } from "@otomat/domain";
import { Chip, FOCUS_RING, Icon, PRStatusBadge, RelativeTime } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { CHECKS_SIGNAL, REVIEW_DECISION_SIGNAL } from "@web/lib/pull-request/inbox/signals";
import { PROVENANCE_LABEL, PROVENANCE_TONE } from "@web/lib/pull-request/provenance";

const ROW_CLASS = `flex flex-col gap-1 rounded-md px-2.5 py-2 hover:bg-hover ${FOCUS_RING} focus-visible:outline-offset-[-2px]`;

export function ReviewInboxRow({ entry }: { entry: PullRequestInboxEntry }) {
  const review =
    entry.review_decision === null ? null : REVIEW_DECISION_SIGNAL[entry.review_decision];
  const checks = CHECKS_SIGNAL[entry.checks_state];

  return (
    <Link
      to="/pull-requests/$pullRequestId/diff"
      params={{ pullRequestId: entry.id }}
      className={ROW_CLASS}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          <span className="font-mono text-xs text-text-tertiary">
            {entry.repository}#{entry.number}
          </span>{" "}
          <span className="font-medium">{entry.title}</span>
        </span>
        <PRStatusBadge status={entry.status} />
        {review === null ? null : <Chip tone={review.tone}>{review.label}</Chip>}
        <Chip tone={checks.tone}>{checks.label}</Chip>
        {entry.mergeable === "conflicting" ? <Chip tone="danger">Conflicts</Chip> : null}
        <Chip tone={PROVENANCE_TONE[entry.provenance]}>{PROVENANCE_LABEL[entry.provenance]}</Chip>
      </span>
      <span className="flex items-center gap-2 text-xs text-text-tertiary">
        <span className="truncate">
          {entry.author_login === null ? "author unknown" : `@${entry.author_login}`}
        </span>
        <RelativeTime date={entry.updated_at} />
        {entry.issue === null ? null : (
          <span className="flex min-w-0 items-center gap-1">
            <Icon name="list-todo" aria-hidden className="h-3 w-3" />
            <span className="truncate">
              {entry.issue.identifier === null ? "" : `${entry.issue.identifier} · `}
              {entry.issue.title}
            </span>
            {entry.issue.evidence === "reference" ? (
              <span className="shrink-0">(named, not attached)</span>
            ) : null}
          </span>
        )}
      </span>
    </Link>
  );
}
