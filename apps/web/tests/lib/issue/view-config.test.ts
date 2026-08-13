import { NO_ADVANCED_FILTERS } from "@web/lib/issue/filters";
import { addView, emptyViewSet } from "@web/lib/issue/saved-view";
import { DEFAULT_ISSUES_VIEW_CONFIG, parseIssuesViewConfig } from "@web/lib/issue/view-config";
import { ALL_ISSUES_VIEW, readIssueViews, writeIssueViews } from "@web/lib/issue/view-storage";
import { describe, expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

describe("parseIssuesViewConfig", () => {
  it("falls back to the default configuration for anything unreadable", () => {
    expect(parseIssuesViewConfig(null)).toEqual(DEFAULT_ISSUES_VIEW_CONFIG);
    expect(parseIssuesViewConfig("board")).toEqual(DEFAULT_ISSUES_VIEW_CONFIG);
  });

  it("keeps known values and drops the rest", () => {
    expect(
      parseIssuesViewConfig({
        layout: "list",
        filter: "active",
        grouping: "assignee",
        sort: "wildcard",
        advanced: { labels: ["bug"] },
        collapsedGroups: ["assignee:Ada", "assignee:Ada", 7],
      }),
    ).toEqual({
      layout: "list",
      filter: "active",
      grouping: "assignee",
      sort: DEFAULT_ISSUES_VIEW_CONFIG.sort,
      advanced: { ...NO_ADVANCED_FILTERS, labels: ["bug"] },
      collapsedGroups: ["assignee:Ada"],
    });
  });
});

describe("issue view storage", () => {
  const mine = { id: "view-1", name: "Mine", config: { ...DEFAULT_ISSUES_VIEW_CONFIG } };

  it("restores a project's views and its last active one", () => {
    const storage = memoryStorage();
    writeIssueViews("project-1", addView(emptyViewSet(ALL_ISSUES_VIEW), mine), storage);
    const restored = readIssueViews("project-1", storage);
    expect(restored.saved).toEqual([mine]);
    expect(restored.activeId).toBe("view-1");
  });

  it("never lets one project's views reach another", () => {
    const storage = memoryStorage();
    writeIssueViews("project-1", addView(emptyViewSet(ALL_ISSUES_VIEW), mine), storage);
    expect(readIssueViews("project-2", storage)).toEqual(emptyViewSet(ALL_ISSUES_VIEW));
  });

  it("always offers All issues as the way back", () => {
    const storage = memoryStorage();
    storage.setItem("otomat.issue-views", '{"project-1":{"saved":[],"activeId":"view-gone"}}');
    const restored = readIssueViews("project-1", storage);
    expect(restored.system).toEqual(ALL_ISSUES_VIEW);
    expect(restored.activeId).toBe(ALL_ISSUES_VIEW.id);
  });

  it("stores no copy of the system view, so its definition stays the code's", () => {
    const storage = memoryStorage();
    writeIssueViews("project-1", emptyViewSet(ALL_ISSUES_VIEW), storage);
    expect(storage.getItem("otomat.issue-views")).toBe(
      JSON.stringify({ "project-1": { saved: [], activeId: ALL_ISSUES_VIEW.id } }),
    );
  });
});
