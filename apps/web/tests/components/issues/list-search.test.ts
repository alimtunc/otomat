import {
  fromAdvancedFilters,
  parseIssuesListSearch,
  toAdvancedFilters,
} from "@web/components/issues/list/search";
import { NO_ADVANCED_FILTERS, type AdvancedIssueFilters } from "@web/lib/issue-filters";
import { describe, expect, it } from "vitest";

describe("parseIssuesListSearch", () => {
  it("leaves every default absent so an untouched list keeps a bare URL", () => {
    expect(parseIssuesListSearch({})).toEqual({});
    expect(parseIssuesListSearch({ layout: "board", filter: "all", assignee: "all" })).toEqual({});
  });

  it("keeps the values a reviewer actually chose", () => {
    expect(
      parseIssuesListSearch({
        layout: "list",
        filter: "active",
        sources: ["linear", "local"],
        states: ["In Progress"],
        assignee: "Ada",
        priority: 2,
      }),
    ).toEqual({
      layout: "list",
      filter: "active",
      sources: ["linear", "local"],
      states: ["In Progress"],
      assignee: "Ada",
      priority: 2,
    });
  });

  it("drops values no control could have produced", () => {
    expect(
      parseIssuesListSearch({
        layout: "grid",
        filter: "archived",
        sources: ["jira", 7],
        states: "In Progress",
        priority: 9,
      }),
    ).toEqual({});
  });
});

describe("advanced filter round trip", () => {
  it("reads an absent axis as off", () => {
    expect(toAdvancedFilters({})).toEqual(NO_ADVANCED_FILTERS);
  });

  it("writes an axis turned off back to absent", () => {
    expect(fromAdvancedFilters(NO_ADVANCED_FILTERS)).toEqual({
      sources: undefined,
      states: undefined,
      assignee: undefined,
      priority: undefined,
    });
  });

  it("survives a round trip through the URL contract", () => {
    const filters: AdvancedIssueFilters = {
      sources: ["linear"],
      states: ["Done"],
      assignee: "unassigned",
      priority: 0,
    };

    expect(toAdvancedFilters(parseIssuesListSearch(fromAdvancedFilters(filters)))).toEqual(filters);
  });
});
