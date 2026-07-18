import type { IssueContract, IssueState } from "@otomat/domain";
import { ISSUE_STATES } from "@otomat/domain";
import { applyIssuesFilter } from "@web/lib/issue-filters";
import { describe, expect, it } from "vitest";

function issue(status: IssueState): IssueContract {
  return {
    id: `issue-${status}`,
    project_id: "project-1",
    title: status,
    body: null,
    status,
    source: "local",
    source_external_id: null,
    synced_at: null,
  };
}

const ALL = ISSUE_STATES.map(issue);

describe("applyIssuesFilter", () => {
  it("returns everything for 'all'", () => {
    expect(applyIssuesFilter(ALL, "all")).toEqual(ALL);
  });

  it("keeps only in-flight states for 'active'", () => {
    const statuses = applyIssuesFilter(ALL, "active").map((i) => i.status);
    expect(statuses).toEqual(["ready", "running", "reviewing", "pr_open"]);
  });

  it("keeps only backlog for 'backlog'", () => {
    const statuses = applyIssuesFilter(ALL, "backlog").map((i) => i.status);
    expect(statuses).toEqual(["backlog"]);
  });
});
