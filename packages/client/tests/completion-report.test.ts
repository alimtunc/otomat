import { expect, it } from "vitest";

import { createDaemonClient } from "#client/client/index";

const EMPTY_REPORT = {
  version: 1,
  run: {
    id: "run-1",
    issue_id: "issue-1",
    branch: "otomat/run/run-1",
    status: "awaiting_human",
    outcome: "interrupted",
    terminal: false,
    evidence: [{ source: "timeline", seq: 8 }],
  },
  plan: { state: "reported", step_count: 1 },
  steps: [],
  diff: {
    state: "not_reported",
    sha: null,
    additions: null,
    deletions: null,
    files: [],
    evidence: [{ source: "diff", file_path: null }],
  },
  commands: [],
  review: {
    state: "not_reported",
    total_comments: 0,
    open_comments: [],
    evidence: [{ source: "review", comment_id: null }],
  },
  pull_request: {
    state: "not_reported",
    number: null,
    url: null,
    status: null,
    publication_status: null,
    error: null,
    evidence: [{ source: "pull_request", url: null }],
  },
  linear: { state: "not_reported", writes: [] },
  errors: [],
  notices: [],
  next_actions: [],
};

it("fetches and validates a run completion report", async () => {
  let calledUrl = "";
  const client = createDaemonClient({
    baseUrl: "http://localhost:4319",
    fetch: async (input) => {
      calledUrl = String(input);
      return new Response(JSON.stringify({ report: EMPTY_REPORT, markdown: "# Run run-1\n" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await client.getRunCompletionReport("run/1");
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run%2F1/report");
  expect(response.report.run.outcome).toBe("interrupted");
});
