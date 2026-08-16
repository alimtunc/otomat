import type { IssueContract, IssueExecution, IssueState } from "@otomat/domain";
import { boardColumnFor, divergentSourceStatus } from "@web/lib/issue/board-column";
import { describe, expect, it } from "vitest";

const NO_EXECUTION: IssueExecution = { state: "none", run_id: null };

function issue(over: {
  status: IssueState;
  execution?: IssueExecution;
  source_state_name?: string | null;
}): IssueContract {
  return {
    id: `issue-${over.status}-${over.execution?.state ?? "none"}`,
    project_id: "project-1",
    title: over.status,
    body: null,
    status: over.status,
    execution: over.execution ?? NO_EXECUTION,
    source: over.source_state_name != null ? "linear" : "local",
    source_external_id: null,
    source_identifier: null,
    source_url: null,
    synced_at: null,
    source_assignee_name: null,
    source_priority: null,
    source_labels: null,
    source_state_name: over.source_state_name ?? null,
    source_state_color: null,
  };
}

describe("boardColumnFor", () => {
  it("uses the source status when there is no execution", () => {
    expect(boardColumnFor(issue({ status: "backlog" }))).toBe("backlog");
  });

  it("lets a live execution win the column", () => {
    expect(
      boardColumnFor(issue({ status: "backlog", execution: { state: "running", run_id: "r1" } })),
    ).toBe("running");
  });

  it("keeps a stopped cycle in Failed instead of falling back to a Ready source status", () => {
    expect(
      boardColumnFor(
        issue({
          status: "ready",
          execution: {
            state: "failed",
            run_id: "r1",
            failure: { reason: "failed", step: { id: "s1", name: "Reviewer" } },
          },
        }),
      ),
    ).toBe("failed");
  });
});

describe("divergentSourceStatus", () => {
  it("surfaces the source status for a local issue whose execution took over the column", () => {
    expect(
      divergentSourceStatus(
        issue({ status: "backlog", execution: { state: "running", run_id: "r1" } }),
      ),
    ).toBe("backlog");
  });

  it("stays silent for a Linear mirror that already shows its status in the header", () => {
    expect(
      divergentSourceStatus(
        issue({
          status: "backlog",
          execution: { state: "running", run_id: "r1" },
          source_state_name: "In Progress",
        }),
      ),
    ).toBeNull();
  });

  it("stays silent when execution does not diverge from the source status", () => {
    expect(divergentSourceStatus(issue({ status: "backlog" }))).toBeNull();
    expect(
      divergentSourceStatus(
        issue({ status: "running", execution: { state: "running", run_id: "r1" } }),
      ),
    ).toBeNull();
  });
});
