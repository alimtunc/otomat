import { groupIssues } from "@web/lib/issue/grouping";
import { describe, expect, it } from "vitest";

import { issueContract, linearIssueContract } from "#support/issue";

const PROJECT_NAMES = new Map([["project-1", "Otomat"]]);

const ada = linearIssueContract({
  id: "a",
  title: "Ada",
  status: "ready",
  source_assignee_name: "Ada",
  source_labels: [
    { name: "ui", color: "#0f0" },
    { name: "bug", color: "#f00" },
  ],
});
const grace = linearIssueContract({
  id: "b",
  title: "Grace",
  status: "backlog",
  source_assignee_name: "Grace",
  source_labels: [{ name: "bug", color: "#f00" }],
});
const orphan = issueContract({ id: "c", title: "Orphan", status: "backlog" });

describe("groupIssues", () => {
  it("has no groups at all when nothing survived the filters", () => {
    expect(groupIssues([], "status", PROJECT_NAMES)).toEqual([]);
    expect(groupIssues([], "none", PROJECT_NAMES)).toEqual([]);
  });

  it("orders status groups by the state machine and drops the empty ones", () => {
    const groups = groupIssues([ada, grace, orphan], "status", PROJECT_NAMES);
    expect(groups.map((group) => group.key)).toEqual(["status:backlog", "status:ready"]);
    expect(groups[0].issues.map((issue) => issue.id)).toEqual(["b", "c"]);
    expect(groups[0].label).toBe("Backlog");
  });

  it("gives a stopped cycle its own column, between Running and Reviewing", () => {
    const stopped = issueContract({
      id: "d",
      title: "Stopped",
      status: "ready",
      execution: {
        state: "failed",
        run_id: "r1",
        failure: { reason: "failed", step: { id: "s1", name: "Reviewer" } },
      },
    });
    const running = issueContract({
      id: "e",
      title: "Working",
      status: "ready",
      execution: { state: "running", run_id: "r2" },
    });

    const groups = groupIssues([stopped, running], "status", PROJECT_NAMES);
    expect(groups.map((group) => group.key)).toEqual(["status:running", "status:failed"]);
    expect(groups[1].label).toBe("Failed");
  });

  it("keeps a closed issue in its own group instead of the stopped column", () => {
    const done = issueContract({
      id: "d",
      title: "Shipped",
      status: "done",
      execution: {
        state: "failed",
        run_id: "r1",
        failure: { reason: "failed", step: { id: "s1", name: "Reviewer" } },
      },
    });
    expect(groupIssues([done], "status", PROJECT_NAMES).map((group) => group.key)).toEqual([
      "status:done",
    ]);
  });

  it("gives blocked and canceled issues a group instead of dropping them off the board", () => {
    const blocked = issueContract({ id: "d", status: "blocked" });
    const canceled = issueContract({ id: "e", status: "canceled" });
    expect(groupIssues([blocked, canceled], "status", PROJECT_NAMES).map((g) => g.key)).toEqual([
      "status:blocked",
      "status:canceled",
    ]);
  });

  it("places a running issue in the column its execution earns", () => {
    const running = issueContract({
      id: "d",
      status: "backlog",
      execution: { state: "running", run_id: "run-1" },
    });
    expect(groupIssues([running], "status", PROJECT_NAMES).map((group) => group.key)).toEqual([
      "status:running",
    ]);
  });

  it("repeats an issue under each of its labels and keeps unlabelled ones last", () => {
    const groups = groupIssues([ada, grace, orphan], "label", PROJECT_NAMES);
    expect(groups.map((group) => group.label)).toEqual(["bug", "ui", "No label"]);
    expect(groups[0].issues.map((issue) => issue.id)).toEqual(["a", "b"]);
    expect(groups[0].color).toBe("#f00");
    expect(groups[2].issues.map((issue) => issue.id)).toEqual(["c"]);
  });

  it("sorts assignees alphabetically and keeps Unassigned last", () => {
    const groups = groupIssues([grace, ada, orphan], "assignee", PROJECT_NAMES);
    expect(groups.map((group) => group.label)).toEqual(["Ada", "Grace", "Unassigned"]);
  });

  it("names a project group from the project list and falls back to its id", () => {
    const elsewhere = issueContract({ id: "e", project_id: "project-2abcdefgh" });
    const groups = groupIssues([ada, elsewhere], "project", PROJECT_NAMES);
    expect(groups.map((group) => group.label)).toEqual(["Otomat", "project-"]);
  });

  it("returns one group carrying everything when the view groups by nothing", () => {
    const groups = groupIssues([ada, grace], "none", PROJECT_NAMES);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("all");
    expect(groups[0].issues).toEqual([ada, grace]);
  });
});
