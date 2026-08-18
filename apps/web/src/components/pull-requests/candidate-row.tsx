import type { PullRequestCandidate } from "@otomat/domain";
import { Button, Chip } from "@otomat/ui";
import { useAttachPullRequest } from "@web/api/prs/mutations";
import { PROVENANCE_LABEL, PROVENANCE_TONE } from "@web/lib/pull-request/provenance";

export interface PullRequestCandidateRowProps {
  issueId: string;
  candidate: PullRequestCandidate;
}

/** A pull request GitHub links to this issue, with the evidence and the reason it is offered — nothing is adopted silently. */
export function PullRequestCandidateRow({ issueId, candidate }: PullRequestCandidateRowProps) {
  const attach = useAttachPullRequest(issueId);
  const { evidence } = candidate;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-subtle px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          #{evidence.number} on {evidence.head_ref}
        </span>
        <Chip tone={PROVENANCE_TONE[candidate.provenance]}>
          {PROVENANCE_LABEL[candidate.provenance]}
        </Chip>
      </div>
      <p className="m-0 text-xs text-text-tertiary">{candidate.reason}</p>
      <Button
        size="xs"
        variant="outline"
        className="self-start"
        loading={attach.isPending}
        onClick={() => attach.mutate({ reference: String(evidence.number) })}
      >
        Attach #{evidence.number}
      </Button>
    </div>
  );
}
