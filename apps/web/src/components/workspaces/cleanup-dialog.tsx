import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@otomat/ui";
import { CleanupTargetRow } from "@web/components/workspaces/cleanup-target-row";
import { ForceConfirm } from "@web/components/workspaces/force-confirm";
import { useBulkCleanup } from "@web/components/workspaces/use-bulk-cleanup";
import { plural } from "@web/lib/plural";
import { describeCleanupLoss, splitCleanupTargets } from "@web/lib/workspace/cleanup";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useState } from "react";

export interface WorkspaceCleanupDialogProps {
  rows: WorkspaceRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned?: () => void;
}

export function WorkspaceCleanupDialog({
  rows,
  open,
  onOpenChange,
  onCleaned,
}: WorkspaceCleanupDialogProps) {
  const cleanup = useBulkCleanup();
  const [forcing, setForcing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const { ready, forced, refused } = splitCleanupTargets(cleanup.targets ?? rows);
  // Forcing is armed from the start when nothing else is deletable, so the dialog never offers "Delete 0".
  const arming = forcing || (ready.length === 0 && forced.length > 0);
  const selected = arming ? [...ready, ...forced] : ready;
  const protectedLoss = describeCleanupLoss(ready);

  const handleOpenChange = (next: boolean): void => {
    if (cleanup.running) return;
    if (!next) {
      if (cleanup.receipt !== null) onCleaned?.();
      cleanup.reset();
      setForcing(false);
      setConfirmed(false);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-label="Clean up workspaces">
        <DialogHeader>
          <DialogTitle>Delete {plural(selected.length, "workspace")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="m-0 text-sm text-text-secondary">
            This deletes each listed worktree, and its local branch only where the branch still
            belongs to the Otomat cycle that made it. Everything already pushed stays on GitHub.
          </p>
          <ul className="m-0 flex list-none flex-col p-0">
            {selected.map((target) => (
              <CleanupTargetRow
                key={target.id}
                target={target}
                outcome={cleanup.outcomes[target.id]}
              />
            ))}
          </ul>
          {protectedLoss === null ? null : (
            <p className="m-0 text-xs text-warning">{`This also discards ${protectedLoss}.`}</p>
          )}
          {forced.length > 0 && !arming ? (
            <Button variant="outline" size="sm" onClick={() => setForcing(true)}>
              Force the {forced.length} git refuses…
            </Button>
          ) : null}
          {arming ? (
            <ForceConfirm targets={forced} checked={confirmed} onCheckedChange={setConfirmed} />
          ) : null}
          {refused.length === 0 ? null : (
            <>
              <p role="alert" className="m-0 text-xs text-danger">
                {plural(refused.length, "workspace")} cannot be deleted here, forced or not, and
                {refused.length === 1 ? " is" : " are"} left untouched:
              </p>
              <ul className="m-0 flex list-none flex-col p-0 opacity-60">
                {refused.map((target) => (
                  <CleanupTargetRow key={target.id} target={target} outcome={undefined} />
                ))}
              </ul>
            </>
          )}
          {cleanup.receipt === null ? null : (
            <p role="status" className="m-0 text-xs text-text-secondary">
              {cleanup.receipt}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          {cleanup.receipt === null ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={cleanup.running}
                onClick={() => handleOpenChange(false)}
              >
                Keep them
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={cleanup.running}
                disabled={cleanup.running || (arming && !confirmed) || selected.length === 0}
                onClick={() => void cleanup.start(selected, arming)}
              >
                {arming ? "Force delete" : "Delete"} {plural(selected.length, "workspace")}
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
