import { expect, it } from "vitest";

import type { IssueExecution } from "#domain/contracts/entities/issue-execution";
import { projectIssueBoardColumn } from "#domain/projections/board-column";
import { ISSUE_TERMINAL_STATES } from "#domain/state-machines/issue";

const FAILED: IssueExecution = {
  state: "failed",
  run_id: "r1",
  failure: { reason: "failed", step: { id: "s1", name: "Reviewer" } },
};

it("falls back to the source status when there is no execution", () => {
  expect(
    projectIssueBoardColumn({ status: "backlog", execution: { state: "none", run_id: null } }),
  ).toBe("backlog");
});

it("lets execution win the column of an open issue", () => {
  expect(
    projectIssueBoardColumn({ status: "backlog", execution: { state: "running", run_id: "r1" } }),
  ).toBe("running");
  expect(projectIssueBoardColumn({ status: "ready", execution: FAILED })).toBe("failed");
});

it("keeps a closed issue in its own column whatever its runs left behind", () => {
  for (const status of ISSUE_TERMINAL_STATES) {
    expect(projectIssueBoardColumn({ status, execution: FAILED })).toBe(status);
    expect(projectIssueBoardColumn({ status, execution: { state: "running", run_id: "r1" } })).toBe(
      status,
    );
  }
});
