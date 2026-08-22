import { inboxRoute } from "@web/lib/inbox/target";
import { describe, expect, it } from "vitest";

describe("inboxRoute", () => {
  it("opens a run's cockpit", () => {
    expect(inboxRoute({ kind: "run", run_id: "run-1" })).toEqual({
      to: "/runs/$runId",
      params: { runId: "run-1" },
    });
  });

  it("opens the panel where a stopped publication is retried", () => {
    expect(inboxRoute({ kind: "run_pull_request", run_id: "run-1" })).toEqual({
      to: "/runs/$runId/pr",
      params: { runId: "run-1" },
    });
  });

  it("opens the reviewer of a pull request that has no run", () => {
    expect(inboxRoute({ kind: "pull_request", pull_request_id: "pr-1" })).toEqual({
      to: "/pull-requests/$pullRequestId/diff",
      params: { pullRequestId: "pr-1" },
    });
  });
});
