import type { IssueContract, IssueState } from "@otomat/domain";
import { ISSUE_STATES } from "@otomat/domain";
import {
  activeAdvancedFilterCount,
  applyAdvancedFilters,
  applyIssuesFilter,
  assigneeOptions,
  NO_ADVANCED_FILTERS,
} from "@web/lib/issue-filters";
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
    source_identifier: null,
    source_url: null,
    synced_at: null,
    source_assignee_name: null,
    source_priority: null,
    source_labels: null,
    source_state_name: null,
    source_state_color: null,
  };
}

function linearIssue(id: string, assignee: string | null, priority: number): IssueContract {
  return {
    id,
    project_id: "project-1",
    title: id,
    body: null,
    status: "ready",
    source: "linear",
    source_external_id: `ext-${id}`,
    source_identifier: `OTO-${id}`,
    source_url: null,
    synced_at: "2026-07-21T10:00:00.000Z",
    source_assignee_name: assignee,
    source_priority: priority,
    source_labels: null,
    source_state_name: priority === 1 ? "Urgent lane" : "In Progress",
    source_state_color: "#facc15",
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
      sources: ["linear", "github"] as ("linear" | "github")[],
      states: [],
      assignee: "Alim" as const,
      priority: 2 as const,
    };
    expect(applyAdvancedFilters(mixed, filters).map((i) => i.id)).toEqual(["a"]);
    expect(activeAdvancedFilterCount(filters)).toBe(3);
  });

  it("filters by the mirrored Linear state name", () => {
    const filters = { ...NO_ADVANCED_FILTERS, states: ["Urgent lane"] };
    expect(applyAdvancedFilters(mixed, filters).map((i) => i.id)).toEqual(["b"]);
    expect(activeAdvancedFilterCount(filters)).toBe(1);
  });

  it("matches unassigned issues explicitly", () => {
    const filters = { ...NO_ADVANCED_FILTERS, assignee: "unassigned" as const };
    expect(applyAdvancedFilters(mixed, filters).map((i) => i.id)).toEqual(["issue-backlog", "c"]);
  });
});

describe("assigneeOptions", () => {
  it("returns distinct sorted names, ignoring unassigned", () => {
    const issues = [
      linearIssue("a", "Fawsy", 1),
      linearIssue("b", "Alim", 2),
      linearIssue("c", "Alim", 3),
      linearIssue("d", null, 0),
    ];
    expect(assigneeOptions(issues)).toEqual(["Alim", "Fawsy"]);
  });
});
