import { rmSync } from "node:fs";

import { createClient, schema } from "@otomat/db";
import type { EventEnvelope } from "@otomat/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { projectRunCompletionReport } from "#api/completion-report";
import type { CanonicalDiff } from "#git";
import { setupTestDb, type TestDb } from "#test-support/db";
import { commentRow, reviewRow, stubReviewService } from "#test-support/review";
import { seedRun, seedWorkflowRun } from "#test-support/seed";

const OCCURRED_AT = "2026-07-22T12:00:00.000Z";

const DIFF: CanonicalDiff = {
  base: "base-sha",
  sha: "diff-sha",
  additions: 4,
  deletions: 1,
  files: [
    {
      path: "src/report.ts",
      oldPath: null,
      status: "added",
      additions: 4,
      deletions: 1,
      binary: false,
      patch: "@@ -0,0 +1 @@\n+report",
      sha: "file-sha",
    },
  ],
};

function insertEvent(t: TestDb, envelope: EventEnvelope): void {
  t.db
    .insert(schema.runtimeEvents)
    .values({
      id: envelope.id,
      run_id: envelope.run_id,
      step_run_id: envelope.step_run_id,
      agent_session_id: envelope.agent_session_id,
      seq: envelope.seq,
      type: envelope.type,
      source: envelope.source,
      occurred_at: envelope.occurred_at,
      payload: envelope.payload,
      raw_ref: envelope.raw_ref,
    })
    .run();
}

function event(overrides: Partial<EventEnvelope>): EventEnvelope {
  return {
    id: "event-1",
    run_id: "run-report",
    step_run_id: "run-report-step",
    agent_session_id: "run-report-session",
    seq: 1,
    type: "runtime.log",
    source: "codex",
    occurred_at: OCCURRED_AT,
    payload: {},
    raw_ref: null,
    ...overrides,
  };
}

describe("run completion report projection", () => {
  let t: TestDb;

  beforeEach(() => {
    t = setupTestDb("otomat-completion-report-");
  });

  afterEach(() => {
    t.cleanup();
  });

  it("projects persisted run evidence and renders the same Markdown after restart", () => {
    const seeded = seedRun(t.db, {
      runId: "run-report",
      runStatus: "completed",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
      providerSessionId: "provider-session-1",
    });
    t.db.insert(schema.agents).values({ id: "codex-agent", name: "Codex", runtime: "codex" }).run();
    t.db.update(schema.agentSessions).set({ agent_id: "codex-agent", exit_code: 0 }).run();
    t.db
      .insert(schema.agentSessions)
      .values({
        id: "a-session",
        step_run_id: seeded.stepRunId,
        agent_id: "codex-agent",
        status: "terminated",
        provider_session_id: "provider-session-0",
        exit_code: 0,
        created_at: OCCURRED_AT,
      })
      .run();
    t.db.update(schema.agentSessions).set({ created_at: OCCURRED_AT }).run();

    insertEvent(
      t,
      event({
        id: "command-call",
        seq: 10,
        type: "runtime.tool_call",
        payload: {
          phase: "call",
          tool: "command_execution",
          tool_use_id: "tool-1",
          args: { command: "pnpm test" },
        },
      }),
    );
    insertEvent(
      t,
      event({
        id: "step-finished",
        seq: 9,
        type: "run.lifecycle",
        payload: { phase: "final", final_status: "completed" },
      }),
    );
    insertEvent(
      t,
      event({
        id: "command-result",
        seq: 11,
        type: "runtime.tool_call",
        payload: {
          phase: "result",
          tool: "command_execution",
          tool_use_id: "tool-1",
          is_error: false,
          result: { exit_code: 0, output: "12 passed" },
        },
      }),
    );
    insertEvent(
      t,
      event({
        id: "echo-call",
        seq: 13,
        type: "runtime.tool_call",
        payload: {
          phase: "call",
          tool: "bash",
          tool_use_id: "tool-echo",
          args: { command: "echo pnpm test" },
        },
      }),
    );
    insertEvent(
      t,
      event({
        id: "run-finished",
        seq: 12,
        type: "run.lifecycle",
        source: "otomat",
        payload: { final_status: "completed" },
      }),
    );

    t.db
      .insert(schema.pullRequests)
      .values({
        id: "pr-1",
        run_id: "run-report",
        number: 42,
        url: "https://github.com/acme/repo/pull/42",
        status: "open",
        publication_status: "created",
        title: "Completion report",
        head_ref: "otomat/run/run-report",
        base_ref: "main",
        published_head_sha: "head-sha",
        published_diff_sha: "diff-sha",
      })
      .run();
    t.db
      .insert(schema.linearWrites)
      .values({
        id: "linear-write-1",
        issue_id: "i1",
        run_id: "run-report",
        kind: "status",
        status: "sent",
        idempotency_key: "status-1",
        payload_json: {},
        detail: "Moved to Done",
      })
      .run();

    const review = stubReviewService({
      getWorktreeDiff: () => ({ computedAt: OCCURRED_AT, diff: DIFF }),
      getReviewDetail: () => ({
        review: reviewRow({ id: "review-1", run_id: "run-report" }),
        comments: [
          commentRow({ id: "z-comment", review_id: "review-1", status: "open" }),
          commentRow({ id: "a-comment", review_id: "review-1", status: "open" }),
        ],
      }),
    });

    const first = projectRunCompletionReport(t.db, "run-report", review);
    expect(first?.report).toMatchObject({
      run: { outcome: "succeeded", status: "completed", terminal: true },
      plan: { state: "reported", step_count: 1 },
      steps: [
        {
          id: seeded.stepRunId,
          runtime: "codex",
          provider_sessions: ["provider-session-0", "provider-session-1"],
          evidence: [{ source: "timeline", seq: 13 }],
        },
      ],
      diff: { state: "reported", sha: "diff-sha", additions: 4, deletions: 1 },
      commands: expect.arrayContaining([
        expect.objectContaining({
          command: "pnpm test",
          kind: "test",
          outcome: "passed",
          exit_code: 0,
        }),
      ]),
      review: { state: "open", total_comments: 2 },
      pull_request: { state: "reported", number: 42, status: "open" },
      linear: { state: "reported", writes: [{ id: "linear-write-1", status: "sent" }] },
    });
    expect(first?.report.commands.find((command) => command.id === "echo-call")?.kind).toBe(
      "command",
    );
    expect(first?.report.review.open_comments.map((comment) => comment.id)).toEqual([
      "a-comment",
      "z-comment",
    ]);
    expect(
      first?.report.commands.find((command) => command.id === "command-call")?.evidence,
    ).toEqual([
      { source: "timeline", seq: 11 },
      { source: "timeline", seq: 10 },
    ]);
    expect(first?.markdown).toContain("## Commands and tests");
    expect(first?.markdown).toContain("`pnpm test` — passed (exit 0)");
    expect(first?.markdown).toContain(
      "[src/report.ts](otomat://app/runs/run-report/diff#diff-file-src%2Freport.ts)",
    );

    const dbPath = t.dbPath;
    const dir = t.dir;
    t.client.sqlite.close();
    const restarted = createClient(dbPath);
    try {
      expect(projectRunCompletionReport(restarted.db, "run-report", review)).toEqual(first);
    } finally {
      restarted.sqlite.close();
      rmSync(dir, { recursive: true, force: true });
      t = { ...t, cleanup: () => {} };
    }
  });

  it("correlates command results within their agent session", () => {
    const seeded = seedRun(t.db, {
      runId: "run-report",
      runStatus: "completed",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    t.db
      .insert(schema.agentSessions)
      .values({
        id: "second-session",
        step_run_id: seeded.stepRunId,
        agent_id: null,
        status: "terminated",
        provider_session_id: "provider-session-2",
      })
      .run();

    for (const envelope of [
      event({
        id: "first-call",
        seq: 1,
        agent_session_id: seeded.agentSessionId,
        type: "runtime.tool_call",
        payload: {
          phase: "call",
          tool: "command_execution",
          tool_use_id: "shared-tool-id",
          args: { command: "pnpm test" },
        },
      }),
      event({
        id: "first-result",
        seq: 2,
        agent_session_id: seeded.agentSessionId,
        type: "runtime.tool_call",
        payload: {
          phase: "result",
          tool_use_id: "shared-tool-id",
          is_error: false,
          result: { exit_code: 0 },
        },
      }),
      event({
        id: "second-call",
        seq: 3,
        agent_session_id: "second-session",
        type: "runtime.tool_call",
        payload: {
          phase: "call",
          tool: "command_execution",
          tool_use_id: "shared-tool-id",
          args: { command: "pnpm test" },
        },
      }),
      event({
        id: "second-result",
        seq: 4,
        agent_session_id: "second-session",
        type: "runtime.tool_call",
        payload: {
          phase: "result",
          tool_use_id: "shared-tool-id",
          is_error: true,
          result: { exit_code: 1 },
        },
      }),
    ]) {
      insertEvent(t, envelope);
    }

    expect(
      projectRunCompletionReport(t.db, "run-report", stubReviewService())?.report.commands.map(
        ({ id, outcome, exit_code: exitCode }) => ({ id, outcome, exitCode }),
      ),
    ).toEqual([
      { id: "first-call", outcome: "passed", exitCode: 0 },
      { id: "second-call", outcome: "failed", exitCode: 1 },
    ]);
  });

  it("keeps missing and corrupt evidence explicit instead of failing the report", () => {
    seedRun(t.db, {
      runId: "run-report",
      runStatus: "failed",
      stepStatus: "stale",
      sessionStatus: "failed",
    });
    t.client.sqlite
      .prepare("UPDATE runs SET plan_json = ? WHERE id = ?")
      .run(JSON.stringify({ invalid: true }), "run-report");
    t.db
      .insert(schema.runtimeEvents)
      .values({
        id: "corrupt-event",
        run_id: "run-report",
        step_run_id: null,
        agent_session_id: null,
        seq: 1,
        type: "not-a-real-event",
        source: "system",
        occurred_at: OCCURRED_AT,
        payload: {},
        raw_ref: null,
      })
      .run();

    const projected = projectRunCompletionReport(
      t.db,
      "run-report",
      stubReviewService({
        getWorktreeDiff: () => {
          throw new Error("worktree missing");
        },
      }),
    );

    expect(projected?.report.run).toMatchObject({ outcome: "failed", status: "failed" });
    expect(projected?.report.plan).toEqual({ state: "corrupt", step_count: null });
    expect(projected?.report.diff.state).toBe("unavailable");
    expect(projected?.report.review.state).toBe("not_reported");
    expect(projected?.report.pull_request.state).toBe("not_reported");
    expect(projected?.report.linear.state).toBe("not_reported");
    expect(projected?.report.notices.map((notice) => notice.code)).toEqual(
      expect.arrayContaining(["plan_corrupt", "events_corrupt"]),
    );
    expect(projected?.report.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["run_failed", "diff_unavailable", "session_failed"]),
    );
    expect(projected?.markdown).toContain("Plan: not reported (corrupt)");
    expect(projected?.markdown).toContain("Diff: unavailable");
  });

  it("returns null for an unknown run", () => {
    expect(projectRunCompletionReport(t.db, "missing", stubReviewService())).toBeNull();
  });

  it("projects an interrupted multi-step workflow in stable evidence order", () => {
    seedWorkflowRun(t.db, {
      runId: "run-report",
      runStatus: "awaiting_human",
      steps: [
        {
          id: "step-one",
          name: "Implement",
          status: "succeeded",
          session: { status: "terminated", providerSessionId: "provider-z" },
        },
        {
          id: "step-two",
          name: "Verify",
          status: "awaiting_human",
          dependsOn: ["step-one"],
          session: { status: "awaiting_input", providerSessionId: "provider-a" },
        },
      ],
    });
    insertEvent(
      t,
      event({
        id: "reconciled",
        seq: 20,
        type: "system.reconciled",
        source: "system",
        step_run_id: null,
        agent_session_id: null,
        payload: { classification: "interrupted" },
      }),
    );

    const projected = projectRunCompletionReport(t.db, "run-report", stubReviewService());

    expect(projected?.report.run).toMatchObject({
      outcome: "interrupted",
      status: "awaiting_human",
      terminal: false,
    });
    expect(projected?.report.steps.map((step) => step.id)).toEqual(["step-one", "step-two"]);
    expect(projected?.report.notices.map((notice) => notice.code)).toContain("run_interrupted");
    expect(projected?.report.next_actions.map((action) => action.code)).toContain("resume_run");
    expect(projected?.markdown).toContain("Result: interrupted");
  });

  it("isolates corrupt review, pull request, and Linear evidence", () => {
    seedRun(t.db, {
      runId: "run-report",
      runStatus: "completed",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    t.db
      .insert(schema.pullRequests)
      .values({
        id: "pr-corrupt",
        run_id: "run-report",
        number: 42,
        url: "https://github.com/acme/repo/pull/42",
        status: "open",
        publication_status: "created",
        title: "Completion report",
        head_ref: "otomat/run/run-report",
        base_ref: "main",
      })
      .run();
    t.db
      .insert(schema.linearWrites)
      .values({
        id: "linear-corrupt",
        issue_id: "i1",
        run_id: "run-report",
        kind: "status",
        status: "sent",
        idempotency_key: "status-corrupt",
        payload_json: {},
      })
      .run();
    t.client.sqlite.prepare("UPDATE pull_requests SET status = 'invalid'").run();
    t.client.sqlite.prepare("UPDATE linear_writes SET status = 'invalid'").run();

    const projected = projectRunCompletionReport(
      t.db,
      "run-report",
      stubReviewService({
        getReviewDetail: () => {
          throw new Error("corrupt review row");
        },
      }),
    );

    expect(projected?.report.review.state).toBe("unavailable");
    expect(projected?.report.pull_request.state).toBe("unavailable");
    expect(projected?.report.linear.state).toBe("unavailable");
    expect(projected?.report.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        "review_unavailable",
        "pull_request_unavailable",
        "linear_unavailable",
      ]),
    );
    expect(projected?.markdown).toContain("Pull request: unavailable");
    expect(projected?.markdown).toContain("Linear: unavailable");
  });
});
