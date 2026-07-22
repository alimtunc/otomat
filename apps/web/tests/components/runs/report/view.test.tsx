// @vitest-environment happy-dom
import type { RunCompletionReportResponse } from "@otomat/domain";
import { RunCompletionReportView } from "@web/components/runs/report/view";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { mount } from "#support/mount";

const RESPONSE: RunCompletionReportResponse = {
  report: {
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
    steps: [
      {
        id: "step-1",
        name: "Implement",
        status: "awaiting_human",
        runtime: "codex",
        provider_sessions: ["provider-1"],
        evidence: [{ source: "timeline", seq: 7 }],
      },
    ],
    diff: {
      state: "reported",
      sha: "diff-sha",
      additions: 3,
      deletions: 1,
      files: [
        {
          path: "src/report.ts",
          status: "added",
          additions: 3,
          deletions: 1,
          evidence: [{ source: "diff", file_path: "src/report.ts" }],
        },
      ],
      evidence: [{ source: "diff", file_path: null }],
    },
    commands: [
      {
        id: "event-6",
        command: "pnpm test",
        kind: "test",
        outcome: "passed",
        exit_code: 0,
        evidence: [{ source: "timeline", seq: 6 }],
      },
    ],
    review: {
      state: "open",
      total_comments: 1,
      open_comments: [
        {
          id: "comment-1",
          file_path: "src/report.ts",
          line: 12,
          body: "Rename this.",
          evidence: [{ source: "review", comment_id: "comment-1" }],
        },
      ],
      evidence: [{ source: "review", comment_id: null }],
    },
    pull_request: {
      state: "reported",
      number: null,
      url: null,
      status: "draft",
      publication_status: "failed",
      error: "GitHub rejected the publication.",
      evidence: [{ source: "pull_request", url: null }],
    },
    linear: {
      state: "reported",
      writes: [
        {
          id: "write-1",
          kind: "status",
          status: "failed",
          detail: null,
          error: "Linear rejected the update.",
          evidence: [{ source: "linear", write_id: "write-1" }],
        },
      ],
    },
    errors: [
      {
        code: "session_failed",
        message: "Session session-1 failed.",
        evidence: [{ source: "timeline", seq: null }],
      },
      {
        code: "session_failed",
        message: "Session session-2 failed.",
        evidence: [{ source: "timeline", seq: null }],
      },
    ],
    notices: [
      {
        code: "run_interrupted",
        message: "Run was interrupted and is waiting for an explicit resume.",
        evidence: [{ source: "timeline", seq: 8 }],
      },
    ],
    next_actions: [
      {
        code: "resume_run",
        message: "Resume the interrupted run when ready.",
        evidence: [{ source: "timeline", seq: 8 }],
      },
    ],
  },
  markdown: "# Run run-1\n\nResult: interrupted\n",
};

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ runId: "run-1" }),
}));

vi.mock("@web/api/runs/queries", () => ({
  useRunCompletionReport: () => ({ isPending: false, isError: false, data: RESPONSE }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

it("renders a responsive evidence-backed report with factual next actions", async () => {
  const { container, cleanup } = await mount(<RunCompletionReportView />);

  expect(container.querySelector("h1")?.textContent).toBe("Completion report");
  expect(container.textContent).toContain("Interrupted");
  expect(container.textContent).toContain("pnpm test");
  expect(container.textContent).toContain("Resume the interrupted run when ready.");
  expect(container.textContent).toContain("GitHub rejected the publication.");
  expect(container.textContent).toContain("Linear rejected the update.");
  expect(container.textContent).toContain("Session session-1 failed.");
  expect(container.textContent).toContain("Session session-2 failed.");
  expect(
    container.querySelector('a[href="/runs/run-1/diff#diff-file-src%2Freport.ts"]'),
  ).not.toBeNull();
  expect(container.querySelector('a[href="/runs/run-1#event-8"]')).not.toBeNull();
  expect(container.querySelector("[data-report-grid]")?.className).toContain("grid-cols-1");

  await cleanup();
});

it("exports the exact Markdown locally", async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const { container, cleanup } = await mount(<RunCompletionReportView />);

  const anchor = [...container.querySelectorAll("a")].find(
    (candidate) => candidate.textContent === "Export Markdown",
  );
  if (!anchor) throw new Error("export link missing");
  await act(async () => anchor.click());

  expect(anchor.download).toBe("run-run-1-completion.md");
  expect(decodeURIComponent(anchor.href.split(",")[1] ?? "")).toBe(RESPONSE.markdown);
  expect(click).toHaveBeenCalledOnce();

  await cleanup();
});
