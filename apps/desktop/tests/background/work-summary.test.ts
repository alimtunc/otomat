import type { ActivityContract } from "@otomat/domain";
import { expect, it } from "vitest";

import { hasLiveWork, summarizeLocalWork } from "#main/background/work-summary";

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
    project: { id: "project-1", name: "Otomat" },
    issue: { id: "issue-1", identifier: "OTO-1", title: "Title" },
    run_id: `run-${id}`,
    phase: null,
    updated_at: "2026-09-03T10:00:00.000Z",
  };
}

function publicationActivity(id: string): ActivityContract {
  return {
    kind: "pull_request_publication",
    id,
    bucket: "running",
    operation: {
      id: `operation-${id}`,
      kind: "pull_request_publication",
      state: "running",
      phases: [{ key: "push", label: "Pushing", state: "active" }],
      error: null,
      retryable: false,
      updated_at: "2026-09-03T10:00:00.000Z",
    },
    project: { id: "project-1", name: "Otomat" },
    issue: { id: "issue-1", identifier: "OTO-1", title: "Title" },
    run_id: "run-a",
    phase: "Pushing",
    updated_at: "2026-09-03T10:00:00.000Z",
  };
}

it("counts working runs, runs blocked on the operator, and failures apart", () => {
  const summary = summarizeLocalWork([
    runActivity("a", "running", "running"),
    runActivity("b", "queued", "queued"),
    runActivity("c", "attention", "awaiting_permission"),
    runActivity("d", "attention", "awaiting_human"),
    runActivity("e", "attention", "awaiting_selection"),
    runActivity("f", "attention", "failed"),
    runActivity("g", "attention", "review_ready"),
    runActivity("h", "recent", "completed"),
  ]);

  expect(summary).toEqual({ active: 2, waiting: 3, failed: 1 });
});

it("counts a run waiting on provider capacity as working, since it resumes on its own", () => {
  expect(summarizeLocalWork([runActivity("a", "queued", "waiting_for_provider")])).toEqual({
    active: 1,
    waiting: 0,
    failed: 0,
  });
});

it("counts one workspace once when an operation is projected alongside its run", () => {
  const summary = summarizeLocalWork([
    runActivity("a", "running", "running"),
    publicationActivity("p"),
  ]);

  expect(summary).toEqual({ active: 1, waiting: 0, failed: 0 });
});

it("treats an operation still under way as work a quit would cut short", () => {
  const summary = summarizeLocalWork([
    runActivity("a", "attention", "review_ready"),
    publicationActivity("p"),
  ]);

  expect(summary).toEqual({ active: 1, waiting: 0, failed: 0 });
  expect(hasLiveWork(summary)).toBe(true);
});

it("leaves a run waiting on a review out of the work a quit would interrupt", () => {
  const summary = summarizeLocalWork([runActivity("f", "attention", "review_ready")]);

  expect(summary).toEqual({ active: 0, waiting: 0, failed: 0 });
  expect(hasLiveWork(summary)).toBe(false);
});

it("counts a run blocked on a permission answer as live work", () => {
  expect(
    hasLiveWork(summarizeLocalWork([runActivity("c", "attention", "awaiting_permission")])),
  ).toBe(true);
});

it("leaves a failure out of the work a quit would interrupt", () => {
  expect(hasLiveWork(summarizeLocalWork([runActivity("f", "attention", "failed")]))).toBe(false);
});
