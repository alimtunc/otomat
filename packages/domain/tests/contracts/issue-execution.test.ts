import { expect, it } from "vitest";

import {
  projectIssueExecution,
  type IssueExecutionEvidence,
} from "#domain/contracts/entities/issue-execution";

function ev(over: Partial<IssueExecutionEvidence> & { run_id: string }): IssueExecutionEvidence {
  return {
    run_status: "completed",
    run_created_at: "2026-01-01T00:00:00.000Z",
    pr_open: false,
    ...over,
  };
}

it("projects none when there is no evidence", () => {
  expect(projectIssueExecution([])).toEqual({ state: "none", run_id: null });
});

it("projects none when every run is terminal without a PR", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "r1", run_status: "completed" }),
      ev({ run_id: "r2", run_status: "failed" }),
      ev({ run_id: "r3", run_status: "canceled" }),
    ]),
  ).toEqual({ state: "none", run_id: null });
});

it("treats every non-terminal, pre-review state as active work", () => {
  for (const run_status of [
    "queued",
    "preparing",
    "running",
    "awaiting_permission",
    "awaiting_human",
    "awaiting_selection",
  ] as const) {
    expect(projectIssueExecution([ev({ run_id: "r1", run_status })])).toEqual({
      state: "running",
      run_id: "r1",
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
    projectIssueExecution([ev({ run_id: "r1", run_status: "completed", pr_open: true })]),
  ).toEqual({ state: "pr_open", run_id: "r1" });
});

it("ranks an open PR above a run merely awaiting review", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "review", run_status: "review_ready" }),
      ev({ run_id: "pr", run_status: "completed", pr_open: true }),
    ]),
  ).toEqual({ state: "pr_open", run_id: "pr" });
});

it("keeps live work ahead of an older terminal run with an open PR", () => {
  expect(
    projectIssueExecution([
      ev({
        run_id: "old",
        run_status: "completed",
        pr_open: true,
        run_created_at: "2026-01-01T00:00:00.000Z",
      }),
      ev({ run_id: "new", run_status: "running", run_created_at: "2026-01-02T00:00:00.000Z" }),
    ]),
  ).toEqual({ state: "running", run_id: "new" });
});

it("keeps active status first even when the active run itself carries an open PR", () => {
  expect(
    projectIssueExecution([ev({ run_id: "r1", run_status: "running", pr_open: true })]),
  ).toEqual({ state: "running", run_id: "r1" });
});

it("breaks equal-rank ties toward the most recent run", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "a", run_status: "running", run_created_at: "2026-01-01T00:00:00.000Z" }),
      ev({ run_id: "b", run_status: "running", run_created_at: "2026-01-03T00:00:00.000Z" }),
      ev({ run_id: "c", run_status: "running", run_created_at: "2026-01-02T00:00:00.000Z" }),
    ]),
  ).toEqual({ state: "running", run_id: "b" });
});

it("breaks a same-timestamp tie deterministically by run id", () => {
  expect(
    projectIssueExecution([
      ev({ run_id: "r-a", run_status: "running", run_created_at: "2026-01-01T00:00:00.000Z" }),
      ev({ run_id: "r-b", run_status: "running", run_created_at: "2026-01-01T00:00:00.000Z" }),
    ]),
  ).toEqual({ state: "running", run_id: "r-b" });
});

it("is order-independent for the same evidence", () => {
  const evidence = [
    ev({ run_id: "a", run_status: "review_ready", run_created_at: "2026-01-01T00:00:00.000Z" }),
    ev({
      run_id: "b",
      run_status: "completed",
      pr_open: true,
      run_created_at: "2026-01-02T00:00:00.000Z",
    }),
    ev({ run_id: "c", run_status: "running", run_created_at: "2026-01-03T00:00:00.000Z" }),
  ];
  const forward = projectIssueExecution(evidence);
  expect(projectIssueExecution([...evidence].reverse())).toEqual(forward);
  expect(forward).toEqual({ state: "running", run_id: "c" });
});
