import type { PullRequestIssueLink } from "@otomat/domain";
import { Chip, FOCUS_RING } from "@otomat/ui";
import { Link } from "@tanstack/react-router";

const EVIDENCE_LABEL = {
  attachment: "Attached",
  reference: "Referenced",
} satisfies Record<PullRequestIssueLink["evidence"], string>;

const EVIDENCE_TITLE = {
  attachment: "An Otomat workspace holds this pull request against that issue.",
  reference: "This pull request names that issue; Otomat owns neither of them.",
} satisfies Record<PullRequestIssueLink["evidence"], string>;

export function PullRequestIssueContext({ issue }: { issue: PullRequestIssueLink | null }) {
  if (issue === null) {
    return <span className="text-xs text-text-tertiary">No linked issue</span>;
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Link
        to="/issues/$issueId"
        params={{ issueId: issue.id }}
        title={issue.title}
        className={`flex min-w-0 items-center gap-1.5 text-xs hover:text-foreground ${FOCUS_RING} focus-visible:rounded-sm`}
      >
        {issue.identifier === null ? null : (
          <span className="shrink-0 font-mono text-text-tertiary">{issue.identifier}</span>
        )}
        <span className="truncate text-text-secondary">{issue.title}</span>
      </Link>
      <Chip tone="neutral" title={EVIDENCE_TITLE[issue.evidence]}>
        {EVIDENCE_LABEL[issue.evidence]}
      </Chip>
    </span>
  );
}
