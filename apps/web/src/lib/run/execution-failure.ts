import type { RunCompletionReport } from "@otomat/domain";

export interface ExecutionFailure {
  outcome: "failed" | "canceled" | "interrupted";
  /** Steps that stopped without succeeding, in reported order. */
  steps: { name: string; status: string }[];
  /** What the run recorded about the failure; empty when it recorded nothing. */
  reasons: string[];
}

/** Null when the execution has nothing to warn about — it succeeded, or it is still going. */
export function executionFailure(report: RunCompletionReport): ExecutionFailure | null {
  const { outcome } = report.run;
  if (outcome === "succeeded" || outcome === "in_progress") return null;
  return {
    outcome,
    steps: report.steps.flatMap((step) =>
      step.status === "succeeded" ? [] : [{ name: step.name, status: step.status }],
    ),
    reasons: report.errors.map((error) => error.message),
  };
}
