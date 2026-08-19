import type { PullRequestCandidate } from "@otomat/domain";
import { Button, Chip } from "@otomat/ui";
import { useAttachPullRequest } from "@web/api/prs/mutations";
import { AttachCandidateDialog } from "@web/components/pull-requests/attach-candidate-dialog";
import { pullRequestImportRefusal } from "@web/lib/pull-request/import-error";
import { PROVENANCE_LABEL, PROVENANCE_TONE } from "@web/lib/pull-request/provenance";
import { issueReferenceProof } from "@web/lib/pull-request/reference";
import { useState } from "react";

export interface PullRequestCandidateRowProps {
  issueId: string;
  candidate: PullRequestCandidate;
}

/** A pull request found by an exact reference to this issue: it shows where, by whom and on whose branch, and adopts nothing on its own. */
export function PullRequestCandidateRow({ issueId, candidate }: PullRequestCandidateRowProps) {
  const attach = useAttachPullRequest(issueId);
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { evidence, reference } = candidate;
  const adopt = (): void => {
    attach.mutate(
      { reference: String(evidence.number) },
      {
        onError: (error) =>
          setRefusal(
            pullRequestImportRefusal(error) ??
              "GitHub could not be reached to verify that pull request.",
          ),
        onSettled: () => setConfirming(false),
      },
    );
  };

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-subtle px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          Candidate #{evidence.number} on {evidence.head_ref}
        </span>
        <Chip tone={PROVENANCE_TONE[candidate.provenance]}>
          {PROVENANCE_LABEL[candidate.provenance]}
        </Chip>
      </div>
      <p className="m-0 text-xs text-text-tertiary">
        {evidence.author_login === null ? "Author unknown" : `@${evidence.author_login}`} ·{" "}
        {candidate.reason}
      </p>
      <p className="m-0 break-words text-xs text-text-tertiary">{issueReferenceProof(reference)}</p>
      <Button
        size="xs"
        variant="outline"
        className="self-start"
        loading={attach.isPending}
        onClick={() => {
          setRefusal(null);
          if (candidate.workspace_owned) adopt();
          else setConfirming(true);
        }}
      >
        {`Attach #${evidence.number}${candidate.workspace_owned ? "" : "…"}`}
      </Button>
      {refusal === null ? null : (
        <p role="alert" className="m-0 text-xs text-danger">
          {refusal}
        </p>
      )}
      <AttachCandidateDialog
        candidate={candidate}
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={adopt}
        pending={attach.isPending}
      />
    </div>
  );
}
