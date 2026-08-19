import type { PullRequestCandidate } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@otomat/ui";
import { PROVENANCE_LABEL } from "@web/lib/pull-request/provenance";
import { issueReferenceProof } from "@web/lib/pull-request/reference";

export interface AttachCandidateDialogProps {
  candidate: PullRequestCandidate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}

/** Adopting a pull request no run here owns is never silent; nothing but this confirmation stands between a candidate and an attachment. */
export function AttachCandidateDialog({
  candidate,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: AttachCandidateDialogProps) {
  const { evidence, reference } = candidate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Pull request #{evidence.number} found — attach it to {reference.identifier}?
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="m-0 text-sm text-text-secondary">
            No run on this issue published #{evidence.number}, so Otomat adopts it only on your
            word. Attaching links it to this issue here and changes nothing on GitHub.
          </p>
          <p className="m-0 text-sm text-text-secondary">
            Author {evidence.author_login === null ? "unknown" : `@${evidence.author_login}`} ·
            Provenance {PROVENANCE_LABEL[candidate.provenance]} — {candidate.reason}
          </p>
          <p className="m-0 font-mono text-xs text-text-tertiary">
            {issueReferenceProof(reference)}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" loading={pending} onClick={onConfirm}>
            Attach #{evidence.number}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
