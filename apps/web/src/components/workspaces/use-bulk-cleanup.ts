import type { WorkspaceCleanupResult } from "@otomat/domain";
import { cleanupWorkspaceErrorMessage, useCleanupWorkspace } from "@web/api/workspaces/mutations";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useState } from "react";

export type CleanupOutcome =
  | "pending"
  | { outcome: WorkspaceCleanupResult["outcome"]; message: string };

export interface BulkCleanup {
  /** Frozen at the start, so a refetch emptying the selection cannot blank the receipt. */
  targets: WorkspaceRow[] | null;
  outcomes: Record<string, CleanupOutcome>;
  running: boolean;
  receipt: string | null;
  start: (rows: readonly WorkspaceRow[], force: boolean) => Promise<void>;
  reset: () => void;
}

function receiptOf(outcomes: CleanupOutcome[]): string {
  const count = (kind: WorkspaceCleanupResult["outcome"]): number =>
    outcomes.filter((row) => row !== "pending" && row.outcome === kind).length;
  const parts = [`${count("cleaned")} cleaned`];
  if (count("skipped") > 0) parts.push(`${count("skipped")} skipped`);
  if (count("failed") > 0) parts.push(`${count("failed")} failed`);
  return parts.join(" · ");
}

/** One target at a time on its owning host: a refusal or a host error lands on that row and the next still runs. */
export function useBulkCleanup(): BulkCleanup {
  const cleanup = useCleanupWorkspace();
  const [targets, setTargets] = useState<WorkspaceRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, CleanupOutcome>>({});

  const record = (id: string, outcome: CleanupOutcome): void => {
    setOutcomes((current) => ({ ...current, [id]: outcome }));
  };

  const start = async (rows: readonly WorkspaceRow[], force: boolean): Promise<void> => {
    setTargets([...rows]);
    setOutcomes({});
    setRunning(true);
    for (const row of rows) {
      record(row.id, "pending");
      try {
        const result = await cleanup.mutateAsync({
          hostId: row.host.id,
          workspaceId: row.id,
          force,
        });
        record(row.id, { outcome: result.outcome, message: result.message });
      } catch (error) {
        record(row.id, { outcome: "failed", message: cleanupWorkspaceErrorMessage(error) });
      }
    }
    setRunning(false);
  };

  return {
    targets,
    outcomes,
    running,
    receipt: targets === null || running ? null : receiptOf(Object.values(outcomes)),
    start,
    reset: () => {
      setTargets(null);
      setOutcomes({});
    },
  };
}
