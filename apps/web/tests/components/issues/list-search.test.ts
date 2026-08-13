import {
  hasOverrides,
  issuesConfigFromSearch,
  issuesSearchFromConfig,
  parseIssuesListSearch,
} from "@web/components/issues/list/search";
import { NO_ADVANCED_FILTERS } from "@web/lib/issue/filters";
import { DEFAULT_ISSUES_VIEW_CONFIG, type IssuesViewConfig } from "@web/lib/issue/view-config";
import { describe, expect, it } from "vitest";

const SAVED: IssuesViewConfig = {
  layout: "list",
  filter: "active",
  grouping: "assignee",
  sort: "title",
  advanced: { ...NO_ADVANCED_FILTERS, labels: ["bug"], assignee: "Ada" },
  collapsedGroups: ["assignee:Ada"],
};

describe("parseIssuesListSearch", () => {
  it("reads an absent field as absent, not as a default", () => {
    expect(parseIssuesListSearch({})).toEqual({});
  });

  it("keeps the values a reviewer actually chose", () => {
    expect(
      parseIssuesListSearch({
        view: "view-1",
        layout: "list",
        filter: "active",
        group: "label",
        sort: "priority",
        sources: ["linear", "local"],
        linearStates: ["In Progress"],
        assignee: "Ada",
        priority: 2,
        collapsed: ["label:bug"],
      }),
    ).toEqual({
      view: "view-1",
      layout: "list",
      filter: "active",
      group: "label",
      sort: "priority",
      sources: ["linear", "local"],
      linearStates: ["In Progress"],
      assignee: "Ada",
      priority: 2,
      collapsed: ["label:bug"],
    });
  });

  it("drops values no control could have produced", () => {
    expect(
      parseIssuesListSearch({
        layout: "grid",
        filter: "archived",
        group: "milestone",
        sources: ["jira", 7],
        linearStates: "In Progress",
        priority: 9,
      }),
    ).toEqual({ sources: [] });
  });

  it("tells an emptied axis apart from an untouched one", () => {
    expect(parseIssuesListSearch({ labels: [], priority: "all" })).toEqual({
      labels: [],
      priority: "all",
    });
  });
});

describe("a view and its overrides", () => {
  it("reads a bare URL as exactly what the active view saved", () => {
    expect(issuesConfigFromSearch(SAVED, {})).toEqual(SAVED);
    expect(issuesSearchFromConfig(SAVED, SAVED)).toEqual({
      layout: undefined,
      filter: undefined,
      group: undefined,
      sort: undefined,
      sources: undefined,
      statuses: undefined,
      linearStates: undefined,
      labels: undefined,
      projects: undefined,
      assignee: undefined,
      priority: undefined,
      collapsed: undefined,
    });
    expect(hasOverrides(issuesSearchFromConfig(SAVED, SAVED))).toBe(false);
  });

  it("carries only what diverges from the view", () => {
    const search = issuesSearchFromConfig(SAVED, { ...SAVED, layout: "board" });
    expect(search.layout).toBe("board");
    expect(search.sort).toBeUndefined();
    expect(hasOverrides(search)).toBe(true);
  });

  it("carries an axis the reviewer emptied, so clearing a saved filter survives the URL", () => {
    const cleared: IssuesViewConfig = {
      ...SAVED,
      advanced: NO_ADVANCED_FILTERS,
      collapsedGroups: [],
    };
    const search = issuesSearchFromConfig(SAVED, cleared);
    expect(search.labels).toEqual([]);
    expect(search.assignee).toBe("all");
    expect(search.collapsed).toEqual([]);
    expect(issuesConfigFromSearch(SAVED, parseIssuesListSearch({ ...search }))).toEqual(cleared);
  });

  it("survives a round trip for every axis", () => {
    const config: IssuesViewConfig = {
      layout: "board",
      filter: "backlog",
      grouping: "label",
      sort: "priority",
      advanced: {
        sources: ["linear"],
        statuses: ["running"],
        linearStates: ["Done"],
        labels: ["ui"],
        projects: ["project-1"],
        assignee: "unassigned",
        priority: 0,
      },
      collapsedGroups: ["label:ui"],
    };
    const search = parseIssuesListSearch({ ...issuesSearchFromConfig(SAVED, config) });
    expect(issuesConfigFromSearch(SAVED, search)).toEqual(config);
  });

  it("reads a link written against another view through the view the reader has", () => {
    const search = parseIssuesListSearch({ view: "view-gone", group: "label" });
    expect(issuesConfigFromSearch(DEFAULT_ISSUES_VIEW_CONFIG, search)).toEqual({
      ...DEFAULT_ISSUES_VIEW_CONFIG,
      grouping: "label",
    });
  });
});
