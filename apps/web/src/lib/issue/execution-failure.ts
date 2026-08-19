import type { IssueExecutionFailure } from "@otomat/domain";

const REASON_LABEL = {
  failed: "Failed",
  canceled: "Canceled",
  interrupted: "Interrupted",
} satisfies Record<IssueExecutionFailure["reason"], string>;

/** One sentence a reader can act on: what stopped the cycle, and where it stopped. */
export function failureSummary(failure: IssueExecutionFailure): string {
  const label = REASON_LABEL[failure.reason];
  return failure.step === null ? label : `${label} at ${failure.step.name}`;
}
