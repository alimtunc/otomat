import type { IssueExecution } from "@otomat/domain";
import { divergentSourceStatus } from "@web/lib/issue/divergent-status";
import { describe, expect, it } from "vitest";

import { issueContract, linearIssueContract, openWorkspace } from "#support/issue";

const RUNNING: IssueExecution = { state: "running", run_id: "run-1" };
const OPEN = openWorkspace("run-1", "running");

describe("divergentSourceStatus", () => {
  it("surfaces the source status for a local issue whose execution won the primary state", () => {
    expect(
      divergentSourceStatus(
        issueContract({ status: "backlog", execution: RUNNING, workspace: OPEN }),
      ),
    ).toBe("backlog");
  });

  it("stays silent for a Linear mirror that already shows its status in the header", () => {
    expect(
      divergentSourceStatus(
        linearIssueContract({
          status: "backlog",
          execution: RUNNING,
          workspace: OPEN,
          source_state_name: "In Progress",
        }),
      ),
    ).toBeNull();
  });

  it("stays silent when execution does not diverge from the source status", () => {
    expect(divergentSourceStatus(issueContract({ status: "backlog" }))).toBeNull();
    expect(
      divergentSourceStatus(
        issueContract({ status: "running", execution: RUNNING, workspace: OPEN }),
      ),
    ).toBeNull();
    expect(
      divergentSourceStatus(issueContract({ status: "done", execution: RUNNING, workspace: OPEN })),
    ).toBeNull();
  });

  it("stays silent once the cycle is closed, when the status is the primary state again", () => {
    expect(
      divergentSourceStatus(issueContract({ status: "backlog", execution: RUNNING })),
    ).toBeNull();
  });
});
