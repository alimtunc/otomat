import type { PullRequestInboxEntry } from "@otomat/domain";
import { Chip, PRStatusBadge } from "@otomat/ui";
import { InboxRow } from "@web/components/inbox/row";
import { INBOX_GROUP_COPY } from "@web/lib/pull-request/inbox/groups";
import { CHECKS_SIGNAL, reviewDecisionSignal } from "@web/lib/pull-request/inbox/signals";
import {
  PULL_REQUEST_PROVENANCE_LABEL,
  PULL_REQUEST_PROVENANCE_TONE,
} from "@web/lib/pull-request/provenance";

function entryReason(entry: PullRequestInboxEntry, viewerLogin: string | null): string {
  let author = entry.author_login === null ? "author unknown" : `@${entry.author_login}`;
  if (entry.author_login !== null && entry.author_login === viewerLogin) author = "";
  if (entry.issue === null) return author;
  const identifier = entry.issue.identifier === null ? "" : `${entry.issue.identifier} · `;
  const evidence = entry.issue.evidence === "reference" ? " (named, not attached)" : "";
  return `${author === "" ? "" : `${author} · `}${identifier}${entry.issue.title}${evidence}`;
}

export function ReviewInboxRow({
  entry,
  viewerLogin = null,
}: {
  entry: PullRequestInboxEntry;
  viewerLogin?: string | null;
}) {
  const review = reviewDecisionSignal(entry.review_decision);
  const checks = CHECKS_SIGNAL[entry.checks_state];

  return (
    <InboxRow
      link={{
        to:
          entry.group === "needs_your_review" || entry.group === "needs_team_review"
            ? "/pull-requests/$pullRequestId/diff"
            : "/pull-requests/$pullRequestId/overview",
        params: { pullRequestId: entry.id },
      }}
      leading={<PRStatusBadge status={entry.status} />}
      identifier={`${entry.repository}#${entry.number}`}
      title={entry.title}
      reason={entryReason(entry, viewerLogin)}
      chips={
        <>
          {review === null ? null : <Chip tone={review.tone}>{review.label}</Chip>}
          <Chip tone={checks.tone}>{checks.label}</Chip>
          {entry.mergeable === "conflicting" ? <Chip tone="danger">Conflicts</Chip> : null}
          <Chip tone={PULL_REQUEST_PROVENANCE_TONE[entry.provenance]}>
            {PULL_REQUEST_PROVENANCE_LABEL[entry.provenance]}
          </Chip>
        </>
      }
      time={entry.updated_at}
      action={INBOX_GROUP_COPY[entry.group].action}
    />
  );
}
