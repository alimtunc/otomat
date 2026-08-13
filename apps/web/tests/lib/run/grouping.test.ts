import { groupRunsByIssue, visibleRunGroups } from "@web/lib/run/grouping";
import { DEFAULT_RUNS_VIEW_CONFIG } from "@web/lib/run/view-config";
import { describe, expect, it } from "vitest";

import { issueContract } from "#support/issue";
import { runContract } from "#support/run";

const open = issueContract({ id: "issue-1", title: "Open work", status: "running" });
const shipped = issueContract({ id: "issue-2", title: "Shipped", status: "done" });

const RUNS = [
  runContract({ id: "r1", issue_id: "issue-1", updated_at: "2026-07-20T10:00:00.000Z" }),
  runContract({ id: "r2", issue_id: "issue-2", updated_at: "2026-07-22T10:00:00.000Z" }),
  runContract({
    id: "r3",
    issue_id: "issue-1",
    status: "failed",
    updated_at: "2026-07-21T10:00:00.000Z",
  }),
];

describe("groupRunsByIssue", () => {
  it("gathers each issue's runs, freshest first, and leads with the issue worked on last", () => {
    const groups = groupRunsByIssue(RUNS, [open, shipped]);
    expect(groups.map((group) => group.issueId)).toEqual(["issue-2", "issue-1"]);
    expect(groups[1].runs.map((entry) => entry.id)).toEqual(["r3", "r1"]);
    expect(groups[1].issue).toEqual(open);
  });

  it("still groups a run whose issue this project does not list", () => {
    const groups = groupRunsByIssue([runContract({ id: "r1", issue_id: "issue-9" })], []);
    expect(groups[0].issue).toBeNull();
    expect(groups[0].issueId).toBe("issue-9");
  });
});

describe("visibleRunGroups", () => {
  const groups = groupRunsByIssue(RUNS, [open, shipped]);

  it("hides a done issue's group on arrival and counts it", () => {
    const visible = visibleRunGroups(groups, DEFAULT_RUNS_VIEW_CONFIG);
    expect(visible.groups.map((group) => group.issueId)).toEqual(["issue-1"]);
    expect(visible.hiddenGroups).toBe(1);
    expect(visible.hiddenRuns).toBe(0);
  });

  it("keeps failed runs until they are switched off", () => {
    expect(visibleRunGroups(groups, DEFAULT_RUNS_VIEW_CONFIG).groups[0].runs).toHaveLength(2);
    const hidden = visibleRunGroups(groups, { showFailed: false, showDoneIssues: false });
    expect(hidden.groups[0].runs.map((entry) => entry.id)).toEqual(["r1"]);
    expect(hidden.hiddenRuns).toBe(1);
  });

  it("shows everything once both axes are on", () => {
    const visible = visibleRunGroups(groups, { showFailed: true, showDoneIssues: true });
    expect(visible.groups.map((group) => group.issueId)).toEqual(["issue-2", "issue-1"]);
    expect(visible.hiddenGroups).toBe(0);
  });

  it("counts a group emptied by the failed filter as its runs, not as a hidden issue", () => {
    const onlyFailed = groupRunsByIssue([runContract({ id: "r3", status: "failed" })], [open]);
    const visible = visibleRunGroups(onlyFailed, { showFailed: false, showDoneIssues: true });
    expect(visible.groups).toEqual([]);
    expect(visible.hiddenGroups).toBe(0);
    expect(visible.hiddenRuns).toBe(1);
  });

  it("leaves the runs themselves untouched", () => {
    visibleRunGroups(groups, { showFailed: false, showDoneIssues: false });
    expect(groups[1].runs.map((entry) => entry.status)).toEqual(["failed", "completed"]);
  });
});
