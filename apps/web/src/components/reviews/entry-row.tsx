import type { PullRequestInboxEntry } from "@otomat/domain";
import { Chip, PRStatusBadge } from "@otomat/ui";
import { InboxRow } from "@web/components/inbox/row";
import { INBOX_GROUP_COPY } from "@web/lib/pull-request/inbox/groups";
import { CHECKS_SIGNAL, REVIEW_DECISION_SIGNAL } from "@web/lib/pull-request/inbox/signals";
import { PROVENANCE_LABEL, PROVENANCE_TONE } from "@web/lib/pull-request/provenance";

function entryReason(entry: PullRequestInboxEntry): string {
  const author = entry.author_login === null ? "author unknown" : `@${entry.author_login}`;
  if (entry.issue === null) return author;
  const identifier = entry.issue.identifier === null ? "" : `${entry.issue.identifier} · `;
  const evidence = entry.issue.evidence === "reference" ? " (named, not attached)" : "";
  return `${author} · ${identifier}${entry.issue.title}${evidence}`;
}

export function ReviewInboxRow({ entry }: { entry: PullRequestInboxEntry }) {
  const review =
    entry.review_decision === null ? null : REVIEW_DECISION_SIGNAL[entry.review_decision];
  const checks = CHECKS_SIGNAL[entry.checks_state];

  return (
    <InboxRow
      link={{ to: "/pull-requests/$pullRequestId/diff", params: { pullRequestId: entry.id } }}
      leading={<PRStatusBadge status={entry.status} />}
      identifier={`${entry.repository}#${entry.number}`}
      title={entry.title}
      reason={entryReason(entry)}
      chips={
        <>
          {review === null ? null : <Chip tone={review.tone}>{review.label}</Chip>}
          <Chip tone={checks.tone}>{checks.label}</Chip>
          {entry.mergeable === "conflicting" ? <Chip tone="danger">Conflicts</Chip> : null}
          <Chip tone={PROVENANCE_TONE[entry.provenance]}>{PROVENANCE_LABEL[entry.provenance]}</Chip>
        </>
      }
      time={entry.updated_at}
      action={INBOX_GROUP_COPY[entry.group].action}
    />
  );
}
