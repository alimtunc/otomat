import { expect, it } from "vitest";

import type { IssueExecutionEvidence } from "#domain/projections/evidence";
import { projectIssueWorkspace } from "#domain/projections/issue-workspace";

// Runs are inserted without an explicit timestamp, so the stored shape is SQLite's CURRENT_TIMESTAMP, not ISO-8601.
const AT = (day: string) => `2026-01-0${day} 00:00:00`;

const CLOSED = { state: "closed", run_id: null, branch: null, run_status: null, busy: false };

function ev(over: Partial<IssueExecutionEvidence> & { run_id: string }): IssueExecutionEvidence {
  return {
    run_status: "review_ready",
    run_created_at: AT("1"),
    run_branch: `otomat/run/${over.run_id}`,
    run_abandoned_at: null,
    worktree_status: "active",
    halted_step: null,
    pr_status: null,
    adopted_pr_status: null,
    pr_publication: null,
    ...over,
  };
}

it("projects closed when there is no evidence", () => {
  expect(projectIssueWorkspace([])).toEqual(CLOSED);
});

it("names the branch of the run that still holds an active worktree", () => {
  expect(projectIssueWorkspace([ev({ run_id: "r1" })])).toEqual({
    state: "open",
    run_id: "r1",
    branch: "otomat/run/r1",
    run_status: "review_ready",
    busy: false,
  });
});

it("keeps the workspace open after a failure or a cancel, so the cycle can be resumed", () => {
  for (const run_status of ["failed", "canceled"] as const) {
    expect(projectIssueWorkspace([ev({ run_id: "r1", run_status })])).toMatchObject({
      state: "open",
      run_id: "r1",
      run_status,
      busy: false,
    });
  }
});

it("closes the workspace on a merge and on an explicit abandon", () => {
  expect(projectIssueWorkspace([ev({ run_id: "r1", run_status: "completed" })])).toEqual(CLOSED);
  expect(projectIssueWorkspace([ev({ run_id: "r1", run_abandoned_at: AT("2") })])).toEqual(CLOSED);
});

it("closes the workspace once the worktree is released or never existed", () => {
  for (const worktree_status of ["removed", "archived", null] as const) {
    expect(projectIssueWorkspace([ev({ run_id: "r1", worktree_status })])).toEqual(CLOSED);
  }
});

it("marks the workspace busy while a turn is in flight or blocked mid-turn", () => {
  for (const run_status of ["queued", "preparing", "running", "awaiting_permission"] as const) {
    const workspace = projectIssueWorkspace([ev({ run_id: "r1", run_status })]);
    expect(workspace.busy).toBe(true);
  }
});

it("leaves a resting workspace free for an appended step", () => {
  for (const run_status of ["awaiting_human", "awaiting_selection", "review_ready"] as const) {
    const workspace = projectIssueWorkspace([ev({ run_id: "r1", run_status })]);
    expect(workspace.busy).toBe(false);
  }
});

it("keeps the most recent holder when an older run's worktree also survives", () => {
  expect(
    projectIssueWorkspace([
      ev({ run_id: "old", run_created_at: AT("1") }),
      ev({ run_id: "new", run_created_at: AT("3") }),
    ]),
  ).toMatchObject({ run_id: "new" });
});

it("is order-independent and breaks a same-timestamp tie by run id", () => {
  const evidence = [ev({ run_id: "r-a" }), ev({ run_id: "r-b" })];
  const forward = projectIssueWorkspace(evidence);
  expect(projectIssueWorkspace(evidence.toReversed())).toEqual(forward);
  expect(forward).toMatchObject({ run_id: "r-b" });
});
