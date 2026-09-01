import type { WorkspaceCleanupResult } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@otomat/ui";
import { cleanupWorkspaceErrorMessage, useCleanupWorkspace } from "@web/api/workspaces/mutations";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useState } from "react";

type RowOutcome = "pending" | { outcome: WorkspaceCleanupResult["outcome"]; message: string };

function receipt(outcomes: RowOutcome[]): string {
  const count = (kind: WorkspaceCleanupResult["outcome"]): number =>
    outcomes.filter((row) => row !== "pending" && row.outcome === kind).length;
  const parts = [`${count("cleaned")} cleaned`];
  if (count("skipped") > 0) parts.push(`${count("skipped")} skipped`);
  if (count("failed") > 0) parts.push(`${count("failed")} failed`);
  return parts.join(" · ");
}

export interface BulkCleanupDialogProps {
  rows: WorkspaceRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkCleanupDialog({ rows, open, onOpenChange }: BulkCleanupDialogProps) {
  const cleanup = useCleanupWorkspace();
  const [started, setStarted] = useState<WorkspaceRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, RowOutcome>>({});

  const targets = started ?? rows;
  const finished = started !== null && !running;
  const noun = targets.length === 1 ? "workspace" : "workspaces";

  const handleOpenChange = (next: boolean): void => {
    if (running) return;
    if (!next) {
      setStarted(null);
      setResults({});
    }
    onOpenChange(next);
  };

  const record = (id: string, outcome: RowOutcome): void => {
    setResults((current) => ({ ...current, [id]: outcome }));
  };

  const runCleanup = async (): Promise<void> => {
    const batch = rows;
    setStarted(batch);
    setRunning(true);
    for (const entry of batch) {
      record(entry.id, "pending");
      try {
        const result = await cleanup.mutateAsync({ hostId: entry.host.id, worktreeId: entry.id });
        record(entry.id, { outcome: result.outcome, message: result.message });
      } catch (error) {
        record(entry.id, { outcome: "failed", message: cleanupWorkspaceErrorMessage(error) });
      }
    }
    setRunning(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-label="Clean up workspaces">
        <DialogHeader>
          <DialogTitle>
            Delete {targets.length} {noun}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="m-0 text-sm text-text-secondary">
            This deletes each listed worktree and its local branch. Only workspaces whose cycle is
            closed and whose worktree is clean are listed; merged pull requests and their commits
            stay on GitHub.
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {targets.map((entry) => {
              const outcome = results[entry.id];
              return (
                <li key={entry.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate font-mono text-text-secondary">
                    {entry.branch ?? "detached"}
                  </span>
                  {entry.issue_identifier === null ? null : (
                    <span className="shrink-0 font-mono text-text-tertiary">
                      {entry.issue_identifier}
                    </span>
                  )}
                  {outcome === "pending" ? <Spinner /> : null}
                  {outcome !== undefined && outcome !== "pending" ? (
                    <span
                      className={
                        outcome.outcome === "cleaned"
                          ? "shrink-0 text-success"
                          : "max-w-1/2 truncate text-danger"
                      }
                      title={outcome.message}
                    >
                      {outcome.outcome === "cleaned" ? "cleaned" : outcome.message}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {finished ? (
            <p role="status" className="m-0 text-xs text-text-secondary">
              {receipt(Object.values(results))}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          {finished ? (
            <Button variant="default" size="sm" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={running}
                onClick={() => handleOpenChange(false)}
              >
                Keep them
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={running}
                disabled={running || targets.length === 0}
                onClick={() => void runCleanup()}
              >
                Delete {targets.length} {noun}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
