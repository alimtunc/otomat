import type { PullRequestSync } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@otomat/ui";
import { PullRequestCommitList } from "@web/components/runs/pr/sync/commit-list";

export interface ForcePushDialogProps {
  headRef: string;
  sync: PullRequestSync;
  expectedRemoteSha: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (expectedRemoteSha: string) => void;
  isPending: boolean;
}

export function ForcePushDialog({
  headRef,
  sync,
  expectedRemoteSha,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: ForcePushDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Force push with lease">
        <DialogHeader>
          <DialogTitle>Force push with lease</DialogTitle>
          <DialogDescription>
            This replaces <code className="font-mono">{headRef}</code> on GitHub with this
            workspace’s branch. The push carries the remote head read below as a lease: if the
            branch moved since, the push fails and nothing is overwritten.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-text-tertiary">Remote head</dt>
            <dd className="m-0 font-mono text-text-secondary">{expectedRemoteSha.slice(0, 12)}</dd>
            <dt className="text-text-tertiary">Local head</dt>
            <dd className="m-0 font-mono text-text-secondary">
              {sync.local_head_sha?.slice(0, 12) ?? "unknown"}
            </dd>
          </dl>
          <PullRequestCommitList
            label="Commits this would drop from the pull request"
            commits={sync.replaced}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={isPending}
            disabled={isPending}
            onClick={() => onConfirm(expectedRemoteSha)}
          >
            Force push with lease
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
