import { expect, it } from "vitest";

import type { IssueExecutionEvidence } from "#domain/projections/evidence";
import { projectIssueExecution } from "#domain/projections/issue-execution";

// Runs are inserted without an explicit timestamp, so the stored shape is SQLite's CURRENT_TIMESTAMP, not ISO-8601.
const AT = (day: string) => `2026-01-0${day} 00:00:00`;

const OPEN_PR = { pr_status: "open", pr_publication: "created" } as const;

function ev(over: Partial<IssueExecutionEvidence> & { run_id: string }): IssueExecutionEvidence {
  return {
    run_status: "completed",
    run_created_at: AT("1"),
    run_branch: `otomat/run/${over.run_id}`,
    run_abandoned_at: null,
    worktree_status: "active",
    halted_step: null,
    pr_status: null,
    pr_publication: null,
    ...over,
  };
}

it("projects none when there is no evidence", () => {
  expect(projectIssueExecution([])).toEqual({ state: "none", run_id: null });
});

it("projects none when every run is terminal and holds no workspace", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "r1", run_status: "completed" }),
      ev({ run_id: "r2", run_status: "failed", worktree_status: "removed" }),
      ev({ run_id: "r3", run_status: "canceled", run_abandoned_at: AT("2") }),
    ]),
  ).toEqual({ state: "none", run_id: null });
});

it("treats every busy state as active work", () => {
  for (const run_status of [
    "queued",
    "preparing",
    "running",
    "awaiting_permission",
    "awaiting_selection",
  ] as const) {
    expect(projectIssueExecution([ev({ run_id: "r1", run_status })])).toEqual({
      state: "running",
      run_id: "r1",
    });
  }
});

it("projects a stopped run holding its workspace as failed, never back to its source status", () => {
  const halted_step = { id: "step-2", name: "Reviewer" };
  const reasons = {
    failed: "failed",
    canceled: "canceled",
    awaiting_human: "interrupted",
  } as const;
  for (const [run_status, reason] of Object.entries(reasons)) {
    expect(
      projectIssueExecution([
        ev({ run_id: "r1", run_status: run_status as keyof typeof reasons, halted_step }),
      ]),
    ).toEqual({ state: "failed", run_id: "r1", failure: { reason, step: halted_step } });
  }
});

it("names no step when a run stopped before any step failed", () => {
  expect(projectIssueExecution([ev({ run_id: "r1", run_status: "canceled" })])).toEqual({
    state: "failed",
    run_id: "r1",
    failure: { reason: "canceled", step: null },
  });
});

it("stops projecting failed once the workspace is closed", () => {
  for (const over of [{ worktree_status: null }, { run_abandoned_at: AT("2") }] as const) {
    expect(projectIssueExecution([ev({ run_id: "r1", run_status: "failed", ...over })])).toEqual({
      state: "none",
      run_id: null,
    });
  }
});

it("keeps a newer active run ahead of an older failure", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "old", run_status: "failed", run_created_at: AT("1") }),
      ev({ run_id: "new", run_status: "running", run_created_at: AT("2") }),
    ]),
  ).toEqual({ state: "running", run_id: "new" });
});

it("keeps the more specific review and PR states ahead of a failure of the same instant", () => {
  for (const winner of [
    ev({ run_id: "review", run_status: "review_ready" }),
    ev({ run_id: "pr", run_status: "completed", ...OPEN_PR }),
  ]) {
    const projected = projectIssueExecution([
      winner,
      ev({ run_id: "stopped", run_status: "failed" }),
    ]);
    expect(projected.state).not.toBe("failed");
  }
});

it("lets a completed last run neutralize the failure its cycle replaced", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "stopped", run_status: "failed", run_created_at: AT("1") }),
      ev({ run_id: "merged", run_status: "completed", run_created_at: AT("2") }),
    ]),
  ).toEqual({ state: "none", run_id: null });
});

it("projects the failure of the last run over an older review or PR", () => {
  for (const older of [
    ev({ run_id: "review", run_status: "review_ready", run_created_at: AT("1") }),
    ev({ run_id: "pr", run_status: "completed", ...OPEN_PR, run_created_at: AT("1") }),
  ]) {
    expect(
      projectIssueExecution([
        older,
        ev({ run_id: "stopped", run_status: "canceled", run_created_at: AT("2") }),
      ]),
    ).toEqual({
      state: "failed",
      run_id: "stopped",
      failure: { reason: "canceled", step: null },
    });
  }
});

it("projects reviewing for a review_ready run without a PR", () => {
  expect(projectIssueExecution([ev({ run_id: "r1", run_status: "review_ready" })])).toEqual({
    state: "reviewing",
    run_id: "r1",
  });
});

it("projects pr_open for a terminal run carrying an open PR", () => {
  expect(
    projectIssueExecution([ev({ run_id: "r1", run_status: "completed", ...OPEN_PR })]),
  ).toEqual({ state: "pr_open", run_id: "r1" });
});

it("counts a draft pull request as open once really created", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "r1", run_status: "completed", pr_status: "draft", pr_publication: "created" }),
    ]),
  ).toEqual({ state: "pr_open", run_id: "r1" });
});

it("invents no PR from a publication that never reached the provider", () => {
  for (const pr_publication of ["not_configured", "pushing", "creating", "failed"] as const) {
    expect(
      projectIssueExecution([
        ev({ run_id: "r1", run_status: "completed", pr_status: "open", pr_publication }),
      ]),
    ).toEqual({ state: "none", run_id: null });
  }
});

it("stops counting a merged or closed pull request", () => {
  for (const pr_status of ["merged", "closed"] as const) {
    expect(
      projectIssueExecution([
        ev({ run_id: "r1", run_status: "completed", pr_status, pr_publication: "created" }),
      ]),
    ).toEqual({ state: "none", run_id: null });
  }
});

it("ranks an open PR above a run merely awaiting review", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "review", run_status: "review_ready" }),
      ev({ run_id: "pr", run_status: "completed", ...OPEN_PR }),
    ]),
  ).toEqual({ state: "pr_open", run_id: "pr" });
});

it("keeps live work ahead of an older terminal run with an open PR", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "old", run_status: "completed", ...OPEN_PR, run_created_at: AT("1") }),
      ev({ run_id: "new", run_status: "running", run_created_at: AT("2") }),
    ]),
  ).toEqual({ state: "running", run_id: "new" });
});

it("keeps active status first even when the active run itself carries an open PR", () => {
  expect(projectIssueExecution([ev({ run_id: "r1", run_status: "running", ...OPEN_PR })])).toEqual({
    state: "running",
    run_id: "r1",
  });
});

it("breaks equal-rank ties toward the most recent run", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "a", run_status: "running", run_created_at: AT("1") }),
      ev({ run_id: "b", run_status: "running", run_created_at: AT("3") }),
      ev({ run_id: "c", run_status: "running", run_created_at: AT("2") }),
    ]),
  ).toEqual({ state: "running", run_id: "b" });
});

it("breaks a same-timestamp tie deterministically by run id", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "r-a", run_status: "running", run_created_at: AT("1") }),
      ev({ run_id: "r-b", run_status: "running", run_created_at: AT("1") }),
    ]),
  ).toEqual({ state: "running", run_id: "r-b" });
});

it("reads a run with no recorded timestamp as the oldest one", () => {
  const undated = ev({ run_id: "undated", run_status: "failed", run_created_at: "" });
  expect(
    projectIssueExecution([undated, ev({ run_id: "dated", run_status: "completed" })]),
  ).toEqual({ state: "none", run_id: null });
  expect(projectIssueExecution([undated])).toEqual({
    state: "failed",
    run_id: "undated",
    failure: { reason: "failed", step: null },
  });
});

it("follows a cycle of ordered runs to its last one", () => {
  const evidence = [
    ev({ run_id: "first", run_status: "failed", run_created_at: AT("1") }),
    ev({ run_id: "second", run_status: "completed", run_created_at: AT("2") }),
    ev({ run_id: "third", run_status: "canceled", run_created_at: AT("3") }),
    ev({ run_id: "fourth", run_status: "review_ready", run_created_at: AT("4") }),
  ];
  expect(projectIssueExecution(evidence)).toEqual({ state: "reviewing", run_id: "fourth" });
  expect(projectIssueExecution(evidence.slice(0, 3))).toEqual({
    state: "failed",
    run_id: "third",
    failure: { reason: "canceled", step: null },
  });
  expect(projectIssueExecution(evidence.slice(0, 2))).toEqual({ state: "none", run_id: null });
});

it("is order-independent for the same evidence", () => {
  const evidence = [
    ev({ run_id: "a", run_status: "review_ready", run_created_at: AT("1") }),
    ev({ run_id: "b", run_status: "completed", ...OPEN_PR, run_created_at: AT("2") }),
    ev({ run_id: "c", run_status: "running", run_created_at: AT("3") }),
  ];
  const forward = projectIssueExecution(evidence);
  expect(projectIssueExecution(evidence.toReversed())).toEqual(forward);
  expect(forward).toEqual({ state: "running", run_id: "c" });
});
