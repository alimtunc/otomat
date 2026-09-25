import type { ActivityContract } from "@otomat/domain";
import { expect, it } from "vitest";

import { hasLiveWork, localWorkItems } from "#main/background/work-items";

const AT = "2026-09-03T10:00:00.000Z";

const runWorkItems = (activities: ActivityContract[]) => localWorkItems(activities, []);

function runActivity(
  id: string,
  bucket: ActivityContract["bucket"],
  status: Extract<ActivityContract, { kind: "run" }>["status"],
): ActivityContract {
  return {
    kind: "run",
    id,
    bucket,
    status,
    started_at: AT,
    project: { id: "project-1", name: "Otomat" },
    issue: { id: "issue-1", identifier: "OTO-1", title: "Title" },
    run_id: `run-${id}`,
    phase: null,
    updated_at: AT,
  };
}

function publicationActivity(runId: string): ActivityContract {
  return {
    kind: "pull_request_publication",
    id: `publication-${runId}`,
    bucket: "running",
    operation: {
      id: `operation-${runId}`,
      kind: "pull_request_publication",
      state: "running",
      phases: [{ key: "push", label: "Pushing", state: "active" }],
      error: null,
      retryable: false,
      updated_at: AT,
    },
    project: { id: "project-1", name: "Otomat" },
    issue: { id: "issue-1", identifier: "OTO-1", title: "Title" },
    run_id: runId,
    phase: "Pushing",
    updated_at: AT,
  };
}

it("separates working runs, runs blocked on the operator, and failures", () => {
  const items = runWorkItems([
    runActivity("a", "running", "running"),
    runActivity("b", "queued", "queued"),
    runActivity("c", "attention", "awaiting_permission"),
    runActivity("d", "attention", "awaiting_human"),
    runActivity("e", "attention", "awaiting_selection"),
    runActivity("f", "attention", "failed"),
    runActivity("g", "attention", "review_ready"),
    runActivity("h", "recent", "completed"),
  ]);

  expect(items.map((item) => [item.run_id, item.state])).toEqual([
    ["run-c", "waiting"],
    ["run-d", "waiting"],
    ["run-e", "waiting"],
    ["run-a", "running"],
    ["run-b", "running"],
    ["run-f", "failed"],
  ]);
});

it("reads a run waiting on provider capacity as working, since it resumes on its own", () => {
  expect(runWorkItems([runActivity("a", "queued", "waiting_for_provider")])).toMatchObject([
    { state: "running" },
  ]);
});

it("names each item by its issue, its project and when its work started", () => {
  expect(runWorkItems([runActivity("a", "running", "running")])).toEqual([
    { run_id: "run-a", project: "Otomat", issue: "OTO-1", state: "running", started_at: AT },
  ]);
});

it("falls back to the issue title when the tracker gave it no identifier", () => {
  const activity = runActivity("a", "running", "running");

  const items = runWorkItems([{ ...activity, issue: { ...activity.issue, identifier: null } }]);

  expect(items[0]?.issue).toBe("Title");
});

it("holds one workspace once when an operation is projected alongside its run", () => {
  const items = runWorkItems([
    runActivity("a", "running", "running"),
    publicationActivity("run-a"),
  ]);

  expect(items).toHaveLength(1);
});

it("keeps an operation still under way as work, even under a run that only awaits a review", () => {
  const items = runWorkItems([
    runActivity("a", "attention", "review_ready"),
    publicationActivity("run-a"),
  ]);

  expect(items).toMatchObject([{ run_id: "run-a", state: "running" }]);
});

it("reports a run blocked on the operator as awaiting them, whatever else it publishes", () => {
  const items = runWorkItems([
    publicationActivity("run-a"),
    runActivity("a", "attention", "awaiting_human"),
  ]);

  expect(items).toMatchObject([{ run_id: "run-a", state: "waiting" }]);
});

it("leaves a run waiting on a review and a finished one out entirely", () => {
  expect(
    runWorkItems([
      runActivity("g", "attention", "review_ready"),
      runActivity("h", "recent", "completed"),
    ]),
  ).toEqual([]);
});

it("treats a working run and one blocked on the operator as work a quit would cut short", () => {
  expect(hasLiveWork(runWorkItems([runActivity("a", "running", "running")]))).toBe(true);
  expect(hasLiveWork(runWorkItems([runActivity("a", "attention", "awaiting_human")]))).toBe(true);
});

it("leaves a failure, and an empty reading, out of the work a quit would interrupt", () => {
  expect(hasLiveWork(runWorkItems([runActivity("a", "attention", "failed")]))).toBe(false);
  expect(hasLiveWork([])).toBe(false);
});

it("lists live terminals as running work ahead of failed runs", () => {
  const terminal = {
    id: "00000000-0000-4000-8000-000000000001",
    project_id: "project-1",
    issue_id: null,
    worktree_id: null,
    path: "/repo",
    branch: "main",
    started_at: AT,
    tool: null,
    state: "running" as const,
    exit_code: null,
    signal: null,
  };
  const items = localWorkItems(
    [runActivity("a", "attention", "failed")],
    [terminal, { ...terminal, id: "00000000-0000-4000-8000-000000000002", state: "exited" }],
  );
  expect(items.map((item) => [item.run_id, item.state])).toEqual([
    [null, "running"],
    ["run-a", "failed"],
  ]);
});
