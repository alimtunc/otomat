import { describe, expect, it } from "vitest";

import { projectActivities, type ActivityEvidence } from "#domain/projections/activity";

const NOW = "2026-08-20T12:00:00.000Z";
const OLD = "2026-08-19T12:00:00.000Z";
const WINDOW = { since: "2026-08-20T06:00:00.000Z", limit: 8 };

function evidence(overrides: Partial<ActivityEvidence> = {}): ActivityEvidence {
  return {
    run_id: "run-1",
    run_status: "running",
    run_updated_at: NOW,
    run_abandoned_at: null,
    run_superseded: false,
    current_step: "Implement",
    halted_step: null,
    issue_id: "issue-1",
    issue_identifier: "ABC-1",
    issue_title: "Ship it",
    issue_status: "running",
    project_id: "project-1",
    project_name: "Otomat",
    publication: null,
    ...overrides,
  };
}

const STOPPED_PUBLICATION = {
  id: "pr-1",
  publication_status: "failed",
  failed_phase: "pushing",
  error_code: "github_push_failed",
  error_message: "The branch was rejected.",
  updated_at: NOW,
} as const;

describe("projectActivities", () => {
  it("puts a working run in `running` with the step it is on", () => {
    const [activity] = projectActivities([evidence()], WINDOW);

    expect(activity).toMatchObject({
      kind: "run",
      id: "run:run-1",
      bucket: "running",
      phase: "Implement",
      run_id: "run-1",
      project: { id: "project-1", name: "Otomat" },
      issue: { id: "issue-1", identifier: "ABC-1", title: "Ship it" },
    });
  });

  it.each([
    ["queued", "queued"],
    ["waiting_for_provider", "queued"],
    ["awaiting_permission", "attention"],
    ["awaiting_human", "attention"],
    ["awaiting_selection", "attention"],
    ["review_ready", "attention"],
    ["failed", "attention"],
    ["completed", "recent"],
    ["canceled", "recent"],
  ] as const)("buckets a %s run as %s", (status, bucket) => {
    const [activity] = projectActivities([evidence({ run_status: status })], WINDOW);

    expect(activity?.bucket).toBe(bucket);
  });

  it("names the step that stopped a run once none is in flight", () => {
    const rows = [evidence({ run_status: "failed", current_step: null, halted_step: "Review" })];

    expect(projectActivities(rows, WINDOW)[0]?.phase).toBe("Review");
  });

  it("does not carry a recovered failure's step as the phase of a run that settled", () => {
    const rows = [evidence({ run_status: "completed", current_step: null, halted_step: "Review" })];

    expect(projectActivities(rows, WINDOW)[0]?.phase).toBeNull();
  });

  it("carries the publication as its own activity, phases included", () => {
    const rows = [
      evidence({
        publication: {
          id: "pr-1",
          publication_status: "pushing",
          failed_phase: null,
          error_code: null,
          error_message: null,
          updated_at: NOW,
        },
      }),
    ];

    const publication = projectActivities(rows, WINDOW).find(
      (activity) => activity.kind === "pull_request_publication",
    );

    expect(publication).toMatchObject({
      id: "publication:pr-1",
      bucket: "running",
      phase: "Pushing the branch",
      run_id: "run-1",
    });
  });

  it("sends a stopped publication to `attention` with the phase it stopped in", () => {
    const rows = [
      evidence({
        run_status: "completed",
        publication: {
          id: "pr-1",
          publication_status: "failed",
          failed_phase: "creating",
          error_code: "github_cli_failed",
          error_message: "gh refused",
          updated_at: NOW,
        },
      }),
    ];

    const publication = projectActivities(rows, WINDOW).find(
      (activity) => activity.kind === "pull_request_publication",
    );

    expect(publication).toMatchObject({ bucket: "attention", phase: "Creating the pull request" });
  });

  it("reports no publication activity while none was ever attempted", () => {
    const rows = [
      evidence({
        publication: {
          id: "pr-1",
          publication_status: "not_configured",
          failed_phase: null,
          error_code: null,
          error_message: null,
          updated_at: NOW,
        },
      }),
    ];

    expect(projectActivities(rows, WINDOW).every((activity) => activity.kind === "run")).toBe(true);
  });

  it.each(["done", "canceled"] as const)(
    "keeps the failures of a %s issue out of the attention bucket",
    (issue_status) => {
      const rows = [
        evidence({
          issue_status,
          run_status: "failed",
          current_step: null,
          halted_step: "Implement",
          publication: STOPPED_PUBLICATION,
        }),
      ];

      expect(projectActivities(rows, WINDOW)).toEqual([]);
    },
  );

  it("still shows the work a closed issue has in flight, which the operator can still cancel", () => {
    const rows = [evidence({ issue_status: "done", run_status: "running" })];

    expect(projectActivities(rows, WINDOW)[0]).toMatchObject({ bucket: "running" });
  });

  it("keeps a live run of a closed issue that is blocked on the operator", () => {
    const rows = [evidence({ issue_status: "done", run_status: "awaiting_permission" })];

    expect(projectActivities(rows, WINDOW)[0]).toMatchObject({ bucket: "attention" });
  });

  it("stops alerting on a cycle the operator abandoned, publication included", () => {
    const rows = [
      evidence({
        run_abandoned_at: "2026-08-20T09:00:00.000Z",
        run_status: "failed",
        current_step: null,
        halted_step: "Implement",
        publication: STOPPED_PUBLICATION,
      }),
    ];

    expect(projectActivities(rows, WINDOW)).toEqual([]);
  });

  it("drops a failure a newer run of the same issue has superseded", () => {
    const rows = [
      evidence({
        run_superseded: true,
        run_status: "failed",
        current_step: null,
        halted_step: "Implement",
      }),
    ];

    expect(projectActivities(rows, WINDOW)).toEqual([]);
  });

  it("keeps the current run's failure of an open issue, with what stopped it", () => {
    const rows = [
      evidence({
        run_status: "failed",
        current_step: null,
        halted_step: "Implement",
        publication: STOPPED_PUBLICATION,
      }),
    ];

    expect(projectActivities(rows, WINDOW)).toMatchObject([
      { kind: "run", bucket: "attention", phase: "Implement" },
      {
        kind: "pull_request_publication",
        bucket: "attention",
        operation: { error: { code: "github_push_failed" } },
      },
    ]);
  });

  it("sends a publication a later attempt carried through to `recent`, stale error and all", () => {
    const rows = [
      evidence({ publication: { ...STOPPED_PUBLICATION, publication_status: "created" } }),
    ];

    expect(projectActivities(rows, WINDOW)).toMatchObject([
      { kind: "run", bucket: "running" },
      { kind: "pull_request_publication", bucket: "recent", operation: { error: null } },
    ]);
  });

  it("drops settled work older than the window but keeps unfinished work of any age", () => {
    const rows = [
      evidence({ run_id: "old-done", run_status: "completed", run_updated_at: OLD }),
      evidence({ run_id: "old-waiting", run_status: "awaiting_human", run_updated_at: OLD }),
    ];

    expect(projectActivities(rows, WINDOW).map((activity) => activity.run_id)).toEqual([
      "old-waiting",
    ]);
  });

  it("bounds the recent bucket and keeps the newest of it", () => {
    const rows = Array.from({ length: 4 }, (_unused, index) =>
      evidence({
        run_id: `run-${index}`,
        run_status: "completed",
        run_updated_at: `2026-08-20T1${index}:00:00.000Z`,
      }),
    );

    const recent = projectActivities(rows, { ...WINDOW, limit: 2 });

    expect(recent.map((activity) => activity.run_id)).toEqual(["run-3", "run-2"]);
  });

  it("orders unfinished work before settled work, newest first", () => {
    const rows = [
      evidence({ run_id: "done", run_status: "completed", run_updated_at: NOW }),
      evidence({
        run_id: "queued",
        run_status: "queued",
        run_updated_at: "2026-08-20T07:00:00.000Z",
      }),
      evidence({
        run_id: "live",
        run_status: "running",
        run_updated_at: "2026-08-20T11:00:00.000Z",
      }),
    ];

    expect(projectActivities(rows, WINDOW).map((activity) => activity.run_id)).toEqual([
      "live",
      "queued",
      "done",
    ]);
  });
});
