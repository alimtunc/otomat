import type { AgentSessionState, RunState, RunTerminalState, StepRunState } from "@otomat/domain";

import type { ReconcileClassification } from "./types.js";

interface Targets {
  run: RunState;
  step: StepRunState;
  session: AgentSessionState;
}

/** Each classification's canonical resting/terminal states across the three machines. */
export const TARGETS: Record<ReconcileClassification, Targets> = {
  completed: { run: "review_ready", step: "succeeded", session: "terminated" },
  canceled: { run: "canceled", step: "canceled", session: "terminated" },
  interrupted: { run: "awaiting_human", step: "awaiting_human", session: "awaiting_input" },
  failed: { run: "failed", step: "stale", session: "failed" },
};

export function classify(
  finalStatus: RunTerminalState | null,
  providerSessionId: string | null,
): ReconcileClassification {
  if (finalStatus !== null) return finalStatus;
  if (providerSessionId !== null) return "interrupted";
  return "failed";
}

export function describe(
  classification: ReconcileClassification,
  providerSessionId: string | null,
  orphanTerminated: boolean,
): string {
  const orphan = orphanTerminated ? " (orphan process group terminated)" : "";
  if (classification === "completed") return `terminal marker found: run finished${orphan}`;
  if (classification === "canceled") return `abort marker found: run canceled${orphan}`;
  if (classification === "interrupted") {
    return `ledger cut before completion; resumable via provider session ${providerSessionId}${orphan}`;
  }
  return `process dead with no resumable evidence${orphan}`;
}
