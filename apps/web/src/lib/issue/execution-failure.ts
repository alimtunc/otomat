import type { IssueExecutionFailure } from "@otomat/domain";

const REASON_LABEL: Record<IssueExecutionFailure["reason"], string> = {
  failed: "Failed",
  canceled: "Canceled",
  interrupted: "Interrupted",
};

/** One sentence a reader can act on: what stopped the cycle, and where it stopped. */
export function failureSummary(failure: IssueExecutionFailure): string {
  const label = REASON_LABEL[failure.reason];
  return failure.step === null ? label : `${label} at ${failure.step.name}`;
}
