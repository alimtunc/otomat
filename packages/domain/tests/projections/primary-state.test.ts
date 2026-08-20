import { expect, it } from "vitest";

import type { IssueExecution } from "#domain/contracts/entities/issue-execution";
import {
  CLOSED_ISSUE_WORKSPACE,
  type IssueWorkspace,
} from "#domain/contracts/entities/issue-workspace";
import {
  projectIssuePrimaryState,
  projectOpenCycleExecution,
} from "#domain/projections/primary-state";
import { ISSUE_CLOSED_STATES, type IssueState } from "#domain/state-machines/issue";

const OPEN: IssueWorkspace = {
  state: "open",
  run_id: "run-1",
  branch: "otomat/run/run-1",
  run_status: "review_ready",
  busy: false,
};

const NO_EXECUTION: IssueExecution = { state: "none", run_id: null };
const REVIEWING: IssueExecution = { state: "reviewing", run_id: "run-1" };
const PR_OPEN: IssueExecution = { state: "pr_open", run_id: "run-1" };
const FAILED: IssueExecution = {
  state: "failed",
  run_id: "run-1",
  failure: { reason: "failed", step: { id: "step-1", name: "Reviewer" } },
};

function issue(status: IssueState, execution: IssueExecution, workspace: IssueWorkspace = OPEN) {
  return { status, execution, workspace };
}

it("gives an open cycle's execution to an issue the tracker still calls Todo", () => {
  expect(projectIssuePrimaryState(issue("backlog", REVIEWING))).toEqual({
    axis: "execution",
    state: "reviewing",
    run_id: "run-1",
  });
});

it("names the open pull request of an issue the tracker calls In Progress", () => {
  expect(projectIssuePrimaryState(issue("running", PR_OPEN))).toEqual({
    axis: "execution",
    state: "pr_open",
    run_id: "run-1",
  });
});

it("keeps a closed source status whatever its runs did", () => {
  for (const status of ISSUE_CLOSED_STATES) {
    for (const execution of [FAILED, REVIEWING, PR_OPEN]) {
      expect(projectIssuePrimaryState(issue(status, execution))).toEqual({
        axis: "status",
        state: status,
      });
    }
  }
});

it("hands the state back to the source status once the cycle is closed", () => {
  expect(projectIssuePrimaryState(issue("ready", REVIEWING, CLOSED_ISSUE_WORKSPACE))).toEqual({
    axis: "status",
    state: "ready",
  });
  expect(projectIssuePrimaryState(issue("ready", NO_EXECUTION, CLOSED_ISSUE_WORKSPACE))).toEqual({
    axis: "status",
    state: "ready",
  });
});

it("reads the two axes apart when the tracker and Otomat disagree", () => {
  expect(projectIssuePrimaryState(issue("pr_open", FAILED)).state).toBe("failed");
  expect(projectIssuePrimaryState(issue("running", REVIEWING)).state).toBe("reviewing");
});

it("keeps the execution axis of an open cycle, terminal source status or not", () => {
  expect(projectOpenCycleExecution(issue("backlog", REVIEWING))).toEqual(REVIEWING);
  expect(projectOpenCycleExecution(issue("done", FAILED))).toEqual(FAILED);
});

it("drops the execution axis once the cycle is closed", () => {
  expect(projectOpenCycleExecution(issue("ready", REVIEWING, CLOSED_ISSUE_WORKSPACE))).toBeNull();
  expect(projectOpenCycleExecution(issue("ready", NO_EXECUTION))).toBeNull();
});
