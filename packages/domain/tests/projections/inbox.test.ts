import { describe, expect, it } from "vitest";

import type { ActivityEvidence } from "#domain/projections/activity";
import {
  countOpenInboxEntries,
  countOpenInboxEntriesByProject,
  projectInbox,
  type InboxEvidence,
  type InboxPullRequestEvidence,
} from "#domain/projections/inbox";

const NOW = "2026-08-22T12:00:00.000Z";
const OLD = "2026-08-20T12:00:00.000Z";
const WINDOW = { since: "2026-08-21T12:00:00.000Z", limit: 12 };
const VIEWER = { login: "operator", teams: ["reviewers"] };

function run(overrides: Partial<ActivityEvidence> = {}): ActivityEvidence {
  return {
    run_id: "run-1",
    run_status: "failed",
    run_updated_at: NOW,
    run_abandoned_at: null,
    run_superseded: false,
    current_step: "Implement",
    halted_step: "Check",
    issue_id: "issue-1",
    issue_identifier: "OTO-1",
    issue_title: "Ship it",
    issue_status: "running",
    project_id: "project-1",
    project_name: "Otomat",
    publication: null,
    ...overrides,
  };
}

function pullRequest(overrides: Partial<InboxPullRequestEvidence> = {}): InboxPullRequestEvidence {
  return {
    pull_request_id: "pr-1",
    run_id: null,
    project_id: "project-2",
    project_name: "Cockpit",
    title: "Add the inbox",
    issue: null,
    facts: {
      status: "open",
      author_login: "someone",
      review_decision: "review_required",
      checks_state: "passing",
      mergeable: "mergeable",
      requested_reviewers: [{ kind: "user", handle: "operator" }],
    },
    updated_at: NOW,
    ...overrides,
  };
}

const STOPPED_PUBLICATION = {
  id: "pr-9",
  publication_status: "failed",
  failed_phase: "pushing",
  error_code: "github_push_failed",
  error_message: "The branch was rejected.",
  updated_at: NOW,
} as const;

function inbox(evidence: Partial<InboxEvidence> = {}) {
  return projectInbox({ runs: [], pull_requests: [], viewer: VIEWER, ...evidence }, WINDOW);
}

describe("projectInbox aggregation", () => {
  it("reports a failed run with the step that stopped it", () => {
    expect(inbox({ runs: [run()] })).toEqual([
      {
        id: "run:run-1",
        kind: "run_failed",
        state: "open",
        project: { id: "project-1", name: "Otomat" },
        subject: { title: "Ship it", identifier: "OTO-1" },
        target: { kind: "run", run_id: "run-1" },
        detail: "Check",
        updated_at: NOW,
      },
    ]);
  });

  it("names the blocked step for a run waiting on the operator", () => {
    const [entry] = inbox({ runs: [run({ run_status: "awaiting_permission" })] });

    expect(entry).toMatchObject({ kind: "permission_request", detail: "Implement" });
  });

  it("covers every project the host holds", () => {
    const entries = inbox({
      runs: [run({ run_status: "awaiting_human" })],
      pull_requests: [pullRequest()],
    });

    expect(entries.map((entry) => entry.project.id).toSorted()).toEqual(["project-1", "project-2"]);
  });

  it("reads newest first", () => {
    const entries = inbox({
      runs: [
        run({ run_id: "run-old", run_updated_at: OLD }),
        run({ run_id: "run-new", run_updated_at: NOW }),
      ],
    });

    expect(entries.map((entry) => entry.target)).toEqual([
      { kind: "run", run_id: "run-new" },
      { kind: "run", run_id: "run-old" },
    ]);
  });

  it("reports a stopped publication with the error the daemon recorded", () => {
    const [entry] = inbox({
      runs: [run({ run_status: "review_ready", publication: STOPPED_PUBLICATION })],
    });

    expect(entry).toMatchObject({
      kind: "publication_stopped",
      detail: "The branch was rejected.",
      target: { kind: "run_pull_request", run_id: "run-1" },
    });
  });

  it("names the pull request itself when no issue anchors it", () => {
    const [entry] = inbox({ pull_requests: [pullRequest()] });

    expect(entry).toMatchObject({
      kind: "pull_request_review_requested",
      subject: { title: "Add the inbox", identifier: null },
      target: { kind: "pull_request", pull_request_id: "pr-1" },
    });
  });

  it("prefers the issue over the pull request title when one anchors it", () => {
    const [entry] = inbox({
      pull_requests: [pullRequest({ issue: { title: "Ship it", identifier: "OTO-1" } })],
    });

    expect(entry?.subject).toEqual({ title: "Ship it", identifier: "OTO-1" });
  });

  it("reports a pull request its own checks block", () => {
    const [entry] = inbox({
      pull_requests: [
        pullRequest({
          facts: {
            status: "open",
            author_login: "operator",
            review_decision: null,
            checks_state: "failing",
            mergeable: "mergeable",
            requested_reviewers: [],
          },
        }),
      ],
    });

    expect(entry).toMatchObject({ kind: "pull_request_blocked" });
  });

  it("asks nothing for a pull request waiting on somebody else", () => {
    const entries = inbox({
      pull_requests: [
        pullRequest({
          facts: {
            status: "open",
            author_login: "someone",
            review_decision: "review_required",
            checks_state: "passing",
            mergeable: "mergeable",
            requested_reviewers: [{ kind: "team", handle: "reviewers" }],
          },
        }),
      ],
    });

    expect(entries).toEqual([]);
  });
});

describe("projectInbox deduplication", () => {
  it("gives a run one entry, whatever else its evidence carries", () => {
    const entries = inbox({
      runs: [run({ run_status: "awaiting_human", publication: STOPPED_PUBLICATION })],
    });

    expect(entries.filter((entry) => entry.target.kind === "run")).toHaveLength(1);
  });

  it("lets the stopped publication speak for the review its run is waiting for", () => {
    const entries = inbox({
      runs: [run({ run_status: "review_ready", publication: STOPPED_PUBLICATION })],
    });

    expect(entries.map((entry) => entry.kind)).toEqual(["publication_stopped"]);
  });

  it("drops the pull request's own review entry while its publication is stopped", () => {
    const entries = inbox({
      runs: [run({ run_status: "review_ready", publication: STOPPED_PUBLICATION })],
      pull_requests: [pullRequest({ pull_request_id: "pr-9", run_id: "run-1" })],
    });

    expect(entries.map((entry) => entry.id)).toEqual(["publication:pr-9"]);
  });

  it("lets the pull request absorb the review its run is waiting for", () => {
    const entries = inbox({
      runs: [run({ run_status: "review_ready" })],
      pull_requests: [pullRequest({ run_id: "run-1" })],
    });

    expect(entries.map((entry) => entry.kind)).toEqual(["pull_request_review_requested"]);
  });

  it("keeps a failed run's entry even when its pull request also asks for review", () => {
    const entries = inbox({
      runs: [run({ run_status: "failed" })],
      pull_requests: [pullRequest({ run_id: "run-1" })],
    });

    expect(entries.map((entry) => entry.kind).toSorted()).toEqual([
      "pull_request_review_requested",
      "run_failed",
    ]);
  });
});

describe("projectInbox resolution", () => {
  it("marks a completed run resolved instead of asking again", () => {
    const [entry] = inbox({
      runs: [run({ run_status: "completed", issue_status: "done" })],
    });

    expect(entry).toMatchObject({ kind: "run_review_ready", state: "resolved", detail: null });
  });

  it("drops a resolution older than the window", () => {
    const entries = inbox({
      runs: [run({ run_status: "completed", issue_status: "done", run_updated_at: OLD })],
    });

    expect(entries).toEqual([]);
  });

  it("bounds how many resolutions it carries", () => {
    const runs = Array.from({ length: WINDOW.limit + 3 }, (_, index) =>
      run({ run_id: `run-${index}`, run_status: "completed", issue_status: "done" }),
    );

    expect(inbox({ runs })).toHaveLength(WINDOW.limit);
  });

  it("shows a resolution after the demands still open", () => {
    const entries = inbox({
      runs: [
        run({ run_id: "run-done", run_status: "completed", issue_status: "done" }),
        run({ run_id: "run-broken" }),
      ],
    });

    expect(entries.map((entry) => entry.state)).toEqual(["open", "resolved"]);
  });

  it("withdraws the demand of an abandoned run rather than resolving it", () => {
    expect(inbox({ runs: [run({ run_abandoned_at: NOW })] })).toEqual([]);
    expect(inbox({ runs: [run({ run_status: "completed", run_abandoned_at: NOW })] })).toEqual([]);
  });

  it("withdraws the demand of a superseded run and of a closed issue", () => {
    expect(inbox({ runs: [run({ run_superseded: true })] })).toEqual([]);
    expect(inbox({ runs: [run({ issue_status: "done" })] })).toEqual([]);
  });

  it("counts only what is still open", () => {
    const entries = inbox({
      runs: [
        run({ run_id: "run-done", run_status: "completed", issue_status: "done" }),
        run({ run_id: "run-broken" }),
      ],
    });

    expect(countOpenInboxEntries(entries)).toBe(1);
  });

  it("counts what is still open for each project on its own", () => {
    const entries = inbox({
      runs: [
        run({ run_id: "run-broken" }),
        run({ run_id: "run-waiting", run_status: "awaiting_human" }),
        run({
          run_id: "run-other",
          project_id: "project-2",
          project_name: "Cockpit",
          issue_id: "issue-2",
        }),
        run({ run_id: "run-done", run_status: "completed", issue_status: "done" }),
      ],
    });

    expect(countOpenInboxEntriesByProject(entries)).toEqual(
      new Map([
        ["project-1", 2],
        ["project-2", 1],
      ]),
    );
  });

  it("leaves a project whose only entry resolved out of the counts", () => {
    const entries = inbox({ runs: [run({ run_id: "run-done", run_status: "completed" })] });

    expect(entries.map((entry) => entry.state)).toEqual(["resolved"]);
    expect(countOpenInboxEntriesByProject(entries)).toEqual(new Map());
  });
});
