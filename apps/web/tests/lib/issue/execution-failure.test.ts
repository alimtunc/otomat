import type { IssueExecutionFailureReason } from "@otomat/domain";
import { failureSummary } from "@web/lib/issue/execution-failure";
import { expect, it } from "vitest";

it("names the step a reader is sent to for every reason a cycle stops on", () => {
  const labels = {
    failed: "Failed at Reviewer",
    canceled: "Canceled at Reviewer",
    interrupted: "Interrupted at Reviewer",
  } satisfies Record<IssueExecutionFailureReason, string>;

  // SAFETY: Object.entries widens the keys; the table is keyed by every failure reason.
  const cases = Object.entries(labels) as [IssueExecutionFailureReason, string][];
  for (const [reason, summary] of cases) {
    expect(failureSummary({ reason, step: { id: "s2", name: "Reviewer" } })).toBe(summary);
  }
});

it("falls back to the reason alone when the run stopped before any step did", () => {
  expect(failureSummary({ reason: "canceled", step: null })).toBe("Canceled");
});
