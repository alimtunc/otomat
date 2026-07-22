import { describe, expect, it } from "vitest";

import { runCompletionReportResponseSchema } from "#domain/contracts/completion-report";

const REPORT = {
  version: 1,
  run: {
    id: "run-1",
    issue_id: "issue-1",
    branch: "otomat/run/run-1",
    status: "completed",
    outcome: "succeeded",
    terminal: true,
    evidence: [{ source: "timeline", seq: 18 }],
  },
  plan: { state: "reported", step_count: 1 },
  steps: [
    {
      id: "step-1",
      name: "Implement",
      status: "succeeded",
      runtime: "codex",
      provider_sessions: ["provider-1"],
      evidence: [{ source: "timeline", seq: 17 }],
    },
  ],
  diff: {
    state: "reported",
    sha: "diff-sha",
    additions: 4,
    deletions: 1,
    files: [
      {
        path: "src/report.ts",
        status: "added",
        additions: 4,
        deletions: 1,
        evidence: [{ source: "diff", file_path: "src/report.ts" }],
      },
    ],
    evidence: [{ source: "diff", file_path: null }],
  },
  commands: [
    {
      id: "event-12",
      command: "pnpm test",
      kind: "test",
      outcome: "passed",
      exit_code: 0,
      evidence: [{ source: "timeline", seq: 12 }],
    },
  ],
  review: {
    state: "open",
    total_comments: 1,
    open_comments: [
      {
        id: "comment-1",
        file_path: "src/report.ts",
        line: 8,
        body: "Clarify the name.",
        evidence: [{ source: "review", comment_id: "comment-1" }],
      },
    ],
    evidence: [{ source: "review", comment_id: null }],
  },
  pull_request: {
    state: "reported",
    number: 42,
    url: "https://github.com/acme/repo/pull/42",
    status: "open",
    publication_status: "created",
    error: null,
    evidence: [{ source: "pull_request", url: "https://github.com/acme/repo/pull/42" }],
  },
  linear: {
    state: "reported",
    writes: [
      {
        id: "write-1",
        kind: "status",
        status: "sent",
        detail: "Moved to Done",
        error: null,
        evidence: [{ source: "linear", write_id: "write-1" }],
      },
    ],
  },
  errors: [],
  notices: [],
  next_actions: [],
} as const;

describe("run completion report contract", () => {
  it("parses a structured report and its deterministic Markdown export", () => {
    const parsed = runCompletionReportResponseSchema.parse({
      report: REPORT,
      markdown: "# Run run-1\n\nResult: succeeded\n",
    });

    expect(parsed.report.run.outcome).toBe("succeeded");
    expect(parsed.report.commands[0]?.kind).toBe("test");
    expect(parsed.markdown).toContain("Result: succeeded");
  });

  it("requires missing evidence to be explicit rather than fabricated", () => {
    const parsed = runCompletionReportResponseSchema.parse({
      report: {
        ...REPORT,
        plan: { state: "corrupt", step_count: null },
        diff: {
          state: "not_reported",
          sha: null,
          additions: null,
          deletions: null,
          files: [],
          evidence: [{ source: "diff", file_path: null }],
        },
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
        notices: [
          {
            code: "plan_corrupt",
            message: "Persisted plan could not be read.",
            evidence: [{ source: "timeline", seq: null }],
          },
        ],
      },
      markdown: "# Run run-1\n\nPlan: not reported (corrupt)\nDiff: none reported\n",
    });

    expect(parsed.report.plan.state).toBe("corrupt");
    expect(parsed.report.diff.state).toBe("not_reported");
    expect(parsed.report.notices[0]?.code).toBe("plan_corrupt");
  });

  it("rejects contradictory report states and facts without evidence", () => {
    const invalidReports = [
      { ...REPORT, plan: { state: "reported", step_count: null } },
      { ...REPORT, diff: { ...REPORT.diff, state: "not_reported" } },
      { ...REPORT, review: { ...REPORT.review, state: "resolved" } },
      { ...REPORT, pull_request: { ...REPORT.pull_request, state: "not_reported" } },
      { ...REPORT, linear: { ...REPORT.linear, state: "not_reported" } },
      {
        ...REPORT,
        steps: [{ ...REPORT.steps[0], evidence: [] }],
      },
    ];

    for (const report of invalidReports) {
      expect(
        runCompletionReportResponseSchema.safeParse({ report, markdown: "# Run run-1\n" }).success,
      ).toBe(false);
    }
  });

  it("rejects a generated timestamp that would make restarts nondeterministic", () => {
    expect(
      runCompletionReportResponseSchema.safeParse({
        report: { ...REPORT, generated_at: "2026-07-22T12:00:00.000Z" },
        markdown: "# Run run-1\n",
      }).success,
    ).toBe(false);
  });
});
