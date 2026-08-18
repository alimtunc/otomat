import type { PullRequestContract } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@otomat/ui";
import { useDetachPullRequest } from "@web/api/prs/mutations";

export interface DetachPullRequestDialogProps {
  issueId: string;
  pullRequest: PullRequestContract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The only place an attachment is removed; it says what stays, because detaching touches nothing on GitHub. */
export function DetachPullRequestDialog({
  issueId,
  pullRequest,
  open,
  onOpenChange,
}: DetachPullRequestDialogProps) {
  const detach = useDetachPullRequest(issueId);
  const evidence = pullRequest.attachment?.evidence ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Remove this attachment">
        <DialogHeader>
          <DialogTitle>Remove attachment</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="m-0 text-sm text-text-secondary">
            This unlinks #{pullRequest.number} from this issue in Otomat. The pull request, its
            branch and its commits are untouched on GitHub, and the audit keeps who attached it and
            on what evidence.
          </p>
          {evidence === null ? null : (
            <p className="m-0 font-mono text-xs text-text-tertiary">
              {evidence.repository}#{evidence.number} · {evidence.head_ref} @{" "}
              {evidence.head_sha.slice(0, 7)} → {evidence.base_ref}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={detach.isPending}
            onClick={() => {
              detach.mutate(pullRequest.id, { onSuccess: () => onOpenChange(false) });
            }}
          >
            Remove attachment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
