import type { IssueContract, IssueExecution, IssueState } from "@otomat/domain";
import { ISSUE_STATES } from "@otomat/domain";
import {
  activeAdvancedFilterCount,
  applyAdvancedFilters,
  applyIssuesFilter,
  NO_ADVANCED_FILTERS,
  parseAdvancedFilters,
} from "@web/lib/issue/filters";
import { describe, expect, it } from "vitest";

import { issueContract, linearIssueContract } from "#support/issue";

const NO_EXECUTION: IssueExecution = { state: "none", run_id: null };

function issue(status: IssueState, execution: IssueExecution = NO_EXECUTION): IssueContract {
  return issueContract({ id: `issue-${status}`, title: status, status, execution });
}

function linearIssue(id: string, assignee: string | null, priority: number): IssueContract {
  return linearIssueContract({
    id,
    title: id,
    status: "ready",
    source_external_id: `ext-${id}`,
    source_identifier: `OTO-${id}`,
    source_assignee_name: assignee,
    source_priority: priority,
    source_labels: priority === 1 ? [{ name: "bug", color: "#f00" }] : [],
    source_state_name: priority === 1 ? "Urgent lane" : "In Progress",
    source_state_color: "#facc15",
  });
}

const ALL = ISSUE_STATES.map((status) => issue(status));

describe("applyIssuesFilter", () => {
  it("returns everything for 'all'", () => {
    expect(applyIssuesFilter(ALL, "all")).toEqual(ALL);
  });

  it("keeps the working states for 'active'", () => {
    const statuses = applyIssuesFilter(ALL, "active").map((i) => i.status);
    expect(statuses).toEqual(["ready", "running", "reviewing", "pr_open"]);
  });

  it("keeps only idle backlog issues for 'backlog'", () => {
    const statuses = applyIssuesFilter(ALL, "backlog").map((i) => i.status);
    expect(statuses).toEqual(["backlog"]);
  });

  it("treats a live execution as active whatever the source status says", () => {
    const running = issue("backlog", { state: "running", run_id: "run-1" });
    expect(applyIssuesFilter([running], "active")).toEqual([running]);
    expect(applyIssuesFilter([running], "backlog")).toEqual([]);
  });

  it("leaves a closed issue out of 'active' even when an old run stopped on it", () => {
    const done = issue("done", {
      state: "failed",
      run_id: "run-1",
      failure: { reason: "failed", step: null },
    });
    expect(applyIssuesFilter([done], "active")).toEqual([]);
  });
});

describe("applyAdvancedFilters", () => {
  const mixed = [
    issue("backlog"),
    linearIssue("a", "Alim", 2),
    linearIssue("b", "Fawsy", 1),
    linearIssue("c", null, 0),
  ];

  it("is the identity when every axis is off", () => {
    expect(applyAdvancedFilters(mixed, NO_ADVANCED_FILTERS)).toEqual(mixed);
    expect(activeAdvancedFilterCount(NO_ADVANCED_FILTERS)).toBe(0);
  });

  it("filters by sources, assignee, and priority together", () => {
    const filters = {
      ...NO_ADVANCED_FILTERS,
      sources: ["linear", "github"] as ("linear" | "github")[],
      assignee: "Alim" as const,
      priority: 2 as const,
    };
    expect(applyAdvancedFilters(mixed, filters).map((i) => i.id)).toEqual(["a"]);
    expect(activeAdvancedFilterCount(filters)).toBe(3);
  });

  it("filters by the mirrored Linear state name", () => {
    const filters = { ...NO_ADVANCED_FILTERS, linearStates: ["Urgent lane"] };
    expect(applyAdvancedFilters(mixed, filters).map((i) => i.id)).toEqual(["b"]);
    expect(activeAdvancedFilterCount(filters)).toBe(1);
  });

  it("filters by status, label and project", () => {
    expect(
      applyAdvancedFilters(mixed, { ...NO_ADVANCED_FILTERS, statuses: ["backlog"] }).map(
        (i) => i.id,
      ),
    ).toEqual(["issue-backlog"]);
    expect(
      applyAdvancedFilters(mixed, { ...NO_ADVANCED_FILTERS, labels: ["bug"] }).map((i) => i.id),
    ).toEqual(["b"]);
    expect(applyAdvancedFilters(mixed, { ...NO_ADVANCED_FILTERS, projects: ["other"] })).toEqual(
      [],
    );
  });

  it("reads the status axis from the execution column, like the board", () => {
    const running = issue("backlog", { state: "running", run_id: "run-1" });
    const filters = { ...NO_ADVANCED_FILTERS, statuses: ["running" as const] };
    expect(applyAdvancedFilters([running], filters)).toEqual([running]);
  });

  it("combines axes as an intersection", () => {
    const filters = { ...NO_ADVANCED_FILTERS, labels: ["bug"], assignee: "Alim" as const };
    expect(applyAdvancedFilters(mixed, filters)).toEqual([]);
    expect(activeAdvancedFilterCount(filters)).toBe(2);
  });

  it("matches unassigned issues explicitly", () => {
    const filters = { ...NO_ADVANCED_FILTERS, assignee: "unassigned" as const };
    expect(applyAdvancedFilters(mixed, filters).map((i) => i.id)).toEqual(["issue-backlog", "c"]);
  });
});

describe("parseAdvancedFilters", () => {
  it("falls back to every axis off for anything that is not a record", () => {
    expect(parseAdvancedFilters(null)).toEqual(NO_ADVANCED_FILTERS);
    expect(parseAdvancedFilters("labels")).toEqual(NO_ADVANCED_FILTERS);
  });

  it("drops values no control could have produced", () => {
    expect(
      parseAdvancedFilters({
        sources: ["jira", 7, "linear"],
        statuses: ["archived"],
        priority: 9,
        assignee: 12,
      }),
    ).toEqual({ ...NO_ADVANCED_FILTERS, sources: ["linear"] });
  });

  it("normalises selections so equal filter sets compare equal", () => {
    expect(
      parseAdvancedFilters({ labels: ["ui", "bug", "ui"], sources: ["local", "github"] }),
    ).toEqual({
      ...NO_ADVANCED_FILTERS,
      labels: ["bug", "ui"],
      sources: ["github", "local"],
    });
  });
});
