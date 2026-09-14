import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@otomat/ui";
import { useForm, useStore } from "@tanstack/react-form";
import { CleanupTargetRow } from "@web/components/workspaces/cleanup-target-row";
import { ForceConfirm } from "@web/components/workspaces/force-confirm";
import { useBulkCleanup } from "@web/components/workspaces/use-bulk-cleanup";
import { plural } from "@web/lib/plural";
import { describeCleanupLoss, splitCleanupTargets } from "@web/lib/workspace/cleanup";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { workspaceGitState } from "@web/lib/workspace/state";
import type { RefObject } from "react";

export interface WorkspaceCleanupDialogProps {
  rows: WorkspaceRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned?: () => void;
  finalFocus?: RefObject<HTMLButtonElement | null>;
}

export function WorkspaceCleanupDialog({
  rows,
  open,
  onOpenChange,
  onCleaned,
  finalFocus,
}: WorkspaceCleanupDialogProps) {
  const cleanup = useBulkCleanup();
  const form = useForm({ defaultValues: { forcedIds: new Array<string>() } });
  const forcedIds = useStore(form.store, (state) => state.values.forcedIds);
  const { ready, forced, refused } = splitCleanupTargets(cleanup.targets ?? rows);
  const selected = cleanup.targets ?? [
    ...ready,
    ...forced.filter((target) => forcedIds.includes(target.id)),
  ];
  const arming = selected.some((target) => forcedIds.includes(target.id));
  const clean =
    selected.length > 0 &&
    selected.every(
      (target) => workspaceGitState(target.present, target.uncommitted_files).word === "clean",
    );
  const protectedLoss = describeCleanupLoss(ready);

  const handleOpenChange = (next: boolean): void => {
    if (cleanup.running) return;
    if (!next) {
      if (cleanup.receipt !== null) onCleaned?.();
      cleanup.reset();
      form.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-label="Clean up workspaces"
        finalFocus={finalFocus}
        className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>Delete {plural(selected.length, "workspace")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <p className="m-0 text-sm text-text-secondary">
            Deletes the selected worktrees on their hosts and any local branch still owned by their
            Otomat cycle. Pushed commits stay on the remote. Dirty workspaces are skipped unless
            Force is selected on that row.
          </p>
          <ul className="m-0 flex list-none flex-col p-0">
            {ready.map((target) => (
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
          {forced.length === 0 ? null : (
            <ul className="m-0 flex list-none flex-col p-0">
              {forced.map((target) => (
                <CleanupTargetRow
                  key={target.id}
                  target={target}
                  outcome={cleanup.outcomes[target.id]}
                >
                  <form.Field name="forcedIds">
                    {(field) => (
                      <ForceConfirm
                        target={target}
                        checked={field.state.value.includes(target.id)}
                        disabled={cleanup.running || cleanup.receipt !== null}
                        onCheckedChange={(checked) =>
                          field.handleChange(
                            checked
                              ? [...field.state.value, target.id]
                              : field.state.value.filter((id) => id !== target.id),
                          )
                        }
                      />
                    )}
                  </form.Field>
                </CleanupTargetRow>
              ))}
            </ul>
          )}
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
                disabled={cleanup.running || selected.length === 0}
                onClick={() => void cleanup.start(selected, new Set(forcedIds))}
              >
                {arming ? "Force delete" : "Delete"}{" "}
                {plural(selected.length, clean && !arming ? "clean workspace" : "workspace")}
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
