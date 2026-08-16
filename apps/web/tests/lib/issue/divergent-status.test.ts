import { divergentSourceStatus } from "@web/lib/issue/divergent-status";
import { expect, it } from "vitest";

import { issueContract, linearIssueContract } from "#support/issue";

const RUNNING = { state: "running", run_id: "r1" } as const;

it("surfaces the source status for a local issue whose execution took over the column", () => {
  expect(divergentSourceStatus(issueContract({ status: "backlog", execution: RUNNING }))).toBe(
    "backlog",
  );
});

it("stays silent for a Linear mirror that already shows its status in the header", () => {
  expect(
    divergentSourceStatus(
      linearIssueContract({
        status: "backlog",
        execution: RUNNING,
        source_state_name: "In Progress",
      }),
    ),
  ).toBeNull();
});

it("stays silent when the column does not diverge from the source status", () => {
  expect(divergentSourceStatus(issueContract({ status: "backlog" }))).toBeNull();
  expect(
    divergentSourceStatus(issueContract({ status: "running", execution: RUNNING })),
  ).toBeNull();
  expect(divergentSourceStatus(issueContract({ status: "done", execution: RUNNING }))).toBeNull();
});
