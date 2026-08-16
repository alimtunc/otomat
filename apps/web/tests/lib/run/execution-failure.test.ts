import type { RunCompletionReport } from "@otomat/domain";
import { executionFailure } from "@web/lib/run/execution-failure";
import { expect, it } from "vitest";

const BASE: RunCompletionReport = {
  version: 1,
  run: {
    id: "run-1",
    issue_id: "issue-1",
    branch: "otomat/run/run-1",
    status: "failed",
    outcome: "failed",
    terminal: true,
    evidence: [],
  },
  plan: { state: "reported", step_count: 2 },
  steps: [
    {
      id: "step-1",
      name: "Implement",
      status: "succeeded",
      runtime: "claude",
      provider_sessions: [],
      evidence: [],
    },
    {
      id: "step-2",
      name: "Review",
      status: "failed",
      runtime: "claude",
      provider_sessions: [],
      evidence: [],
    },
  ],
  diff: { state: "not_reported", sha: null, additions: null, deletions: null, files: null },
  commands: [],
  review: { state: "none", total_comments: 0, open_comments: [], evidence: [] },
  pull_request: { state: "none", number: null, url: null, status: null, publication_status: null },
  linear: { state: "not_connected", writes: [] },
  errors: [{ code: "session_failed", message: "Session session-1 failed.", evidence: [] }],
  notices: [],
  next_actions: [],
};

it("names the steps that stopped without succeeding and what the run recorded", () => {
  expect(executionFailure(BASE)).toEqual({
    outcome: "failed",
    steps: [{ name: "Review", status: "failed" }],
    reasons: ["Session session-1 failed."],
  });
});

it.each(["succeeded", "in_progress"] as const)("warns about nothing on a %s run", (outcome) => {
  expect(executionFailure({ ...BASE, run: { ...BASE.run, outcome } })).toBeNull();
});

it.each(["canceled", "interrupted"] as const)(
  "still reports a %s run so its workspace can be published knowingly",
  (outcome) => {
    expect(executionFailure({ ...BASE, run: { ...BASE.run, outcome } })?.outcome).toBe(outcome);
  },
);
