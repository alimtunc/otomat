import type {
  AgentSessionState,
  ProviderLimit,
  RunState,
  RunSettledState,
  StepRunState,
} from "@otomat/domain";

import type { ReconcileClassification } from "./types.js";

export interface Targets {
  run: RunState;
  step: StepRunState;
  session: AgentSessionState;
}

/** Each classification's canonical resting/terminal states across the three machines. */
export const TARGETS = {
  completed: { run: "review_ready", step: "succeeded", session: "terminated" },
  canceled: { run: "canceled", step: "canceled", session: "terminated" },
  interrupted: { run: "awaiting_human", step: "awaiting_human", session: "awaiting_input" },
  // The session is left `idle`, not `awaiting_input`: nobody is being asked anything, and a resume must still be able to reattach it.
  provider_limited: {
    run: "waiting_for_provider",
    step: "waiting_for_provider",
    session: "idle",
  },
  failed: { run: "failed", step: "stale", session: "failed" },
} satisfies Record<ReconcileClassification, Targets>;

/**
 * Classifies a torn run from durable evidence: an explicit terminal marker wins,
 * except that a quota the provider reported turns the marker's `failed` into a
 * recoverable wait. Absent a marker, a known provider session means `interrupted`
 * (resumable); otherwise `failed`. A limit without a marker stays `interrupted`:
 * the turn was killed before it could vouch for its own ending.
 */
export function classify(
  finalStatus: RunSettledState | null,
  providerSessionId: string | null,
  providerLimit: ProviderLimit | null,
): ReconcileClassification {
  if (finalStatus === "failed" && providerLimit !== null) return "provider_limited";
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
  if (classification === "provider_limited") {
    return `the provider reported a quota limit; the step waits for it to reopen${orphan}`;
  }
  return `process dead with no resumable evidence${orphan}`;
}
