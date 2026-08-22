import { createDaemonClient, DaemonRequestError } from "@otomat/client";
import { WORKSPACE_DIFF_SCOPE, type EventEnvelope } from "@otomat/domain";
import { sandboxTransport } from "@web/preview/sandbox/transport";
import { describe, expect, it } from "vitest";

const BUILD = "1a2b3c4";
const RUN_ID = "sandbox-run-2";

/** Every read goes through the real typed client, so each fixture is validated by the daemon's own contracts. */
const daemon = createDaemonClient(sandboxTransport(BUILD));

describe("the preview sandbox", () => {
  it("names the build under test, so diagnostics report the commit rather than a fixture", async () => {
    expect((await daemon.health()).build).toBe(BUILD);
  });

  it("serves the workspace a cockpit boots against", async () => {
    expect(await daemon.listProjects()).toHaveLength(1);
    expect(await daemon.listRepositories()).toHaveLength(1);
    expect((await daemon.agentCapacity()).max_concurrent_sessions).toBeGreaterThan(0);
    expect(await daemon.listRuntimes()).not.toHaveLength(0);
  });

  it("serves the Inbox the navigation counts from", async () => {
    const inbox = await daemon.listInbox();
    expect(inbox.entries.map((entry) => entry.kind)).toEqual(["run_review_ready"]);
  });

  it("serves issues across the board columns, and one issue by id", async () => {
    const issues = await daemon.listIssues();
    expect(issues.length).toBeGreaterThan(3);
    expect(new Set(issues.map((issue) => issue.status)).size).toBeGreaterThan(2);
    expect((await daemon.getIssue("sandbox-issue-2")).workspace.state).toBe("open");
  });

  it("serves a run with its steps, ledger window, usage and commits", async () => {
    const detail = await daemon.getRun(RUN_ID);
    expect(detail.run.id).toBe(RUN_ID);
    expect(detail.steps).toHaveLength(2);
    expect((await daemon.getRunEventWindow(RUN_ID)).events).not.toHaveLength(0);
    expect((await daemon.getRunUsage(RUN_ID)).total.turns).toBeGreaterThan(0);
    expect((await daemon.getRunCommits(RUN_ID)).commits).toHaveLength(1);
  });

  it("serves a reviewable diff with its comments and expandable blobs", async () => {
    const diff = await daemon.getReviewDiff({ kind: "run", id: RUN_ID }, WORKSPACE_DIFF_SCOPE);
    const file = diff.diff?.files[0];
    expect(file?.patch).toContain("@@");
    const review = await daemon.getReviewDetail({ kind: "run", id: RUN_ID });
    expect(review.comments[0]?.diff_sha).toBe(file?.sha);
    const blobs = await daemon.getDiffFileBlobs(
      { kind: "run", id: RUN_ID },
      file?.path ?? "",
      file?.sha ?? "",
      WORKSPACE_DIFF_SCOPE,
    );
    expect(blobs.head_content).toContain("ANCHOR_VERSION");
  });

  it("serves the pull-request inbox", async () => {
    const inbox = await daemon.getPullRequestInbox("sandbox-project");
    expect(inbox.entries[0]?.number).toBe(412);
  });

  it("refuses a write instead of pretending one landed", async () => {
    await expect(daemon.setAgentCapacity({ max_concurrent_sessions: 2 })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof DaemonRequestError &&
        error.status === 503 &&
        JSON.stringify(error.body).includes("sandbox_read_only"),
    );
  });

  it("answers a known route with an unknown id as a 404, so the client raises instead of parsing", async () => {
    await expect(daemon.getIssue("sandbox-issue-404")).rejects.toSatisfy(
      (error: unknown) => error instanceof DaemonRequestError && error.status === 404,
    );
    await expect(daemon.getRun("sandbox-run-404")).rejects.toSatisfy(
      (error: unknown) => error instanceof DaemonRequestError && error.status === 404,
    );
  });

  it("says so when it has no fixture, rather than answering an empty daemon 404", async () => {
    await expect(daemon.getRunCompletionReport(RUN_ID)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof DaemonRequestError &&
        error.status === 501 &&
        JSON.stringify(error.body).includes("sandbox_unsupported"),
    );
  });

  it("replays the run ledger over SSE and closes the stream", async () => {
    const received: EventEnvelope[] = [];
    const ended = await new Promise<string>((resolve) => {
      daemon.subscribeRunEvents(RUN_ID, {
        onEvent: (event) => received.push(event),
        onEnd: (payload) => resolve(payload.status),
        onParseError: (error) => {
          throw error;
        },
      });
    });
    expect(ended).toBe("completed");
    expect(received.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5]);
  });

  it("resumes an SSE stream past the cursor the caller already has", async () => {
    const received: number[] = [];
    await new Promise<void>((resolve) => {
      daemon.subscribeRunEvents(RUN_ID, {
        afterSeq: 3,
        onEvent: (event) => received.push(event.seq),
        onEnd: () => resolve(),
      });
    });
    expect(received).toEqual([4, 5]);
  });
});
