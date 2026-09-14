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
        className={`flex min-w-0 items-center text-xs hover:text-foreground ${FOCUS_RING} focus-visible:rounded-sm`}
      >
        <Chip tone="neutral" title={EVIDENCE_TITLE[issue.evidence]} className="min-w-0">
          <span className="truncate">
            {EVIDENCE_LABEL[issue.evidence]} to {issue.identifier ?? issue.title}
          </span>
        </Chip>
      </Link>
    </span>
  );
}
