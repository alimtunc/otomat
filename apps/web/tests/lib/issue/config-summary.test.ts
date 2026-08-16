import { issuesConfigDetails, issuesConfigSegments } from "@web/lib/issue/config-summary";
import type { IssueFilterOptions } from "@web/lib/issue/filter-options";
import { NO_ADVANCED_FILTERS, type AdvancedIssueFilters } from "@web/lib/issue/filters";
import { DEFAULT_ISSUES_VIEW_CONFIG, type IssuesViewConfig } from "@web/lib/issue/view-config";
import { describe, expect, it } from "vitest";

const OPTIONS: IssueFilterOptions = {
  assignees: [{ value: "Ada", label: "Ada" }],
  linearStates: [{ value: "In Progress", label: "In Progress" }],
  labels: [{ value: "bug", label: "bug" }],
  projects: [{ value: "project-1", label: "otomat" }],
};

function config(advanced: Partial<AdvancedIssueFilters> = {}): IssuesViewConfig {
  return {
    ...DEFAULT_ISSUES_VIEW_CONFIG,
    advanced: { ...NO_ADVANCED_FILTERS, ...advanced },
  };
}

describe("issuesConfigSegments", () => {
  it("names the display axes and counts the filters behind them", () => {
    expect(issuesConfigSegments(config())).toEqual(["Status", "Priority"]);
    expect(issuesConfigSegments(config({ labels: ["bug"] }))).toEqual([
      "Status",
      "Priority",
      "1 filter",
    ]);
    expect(issuesConfigSegments(config({ labels: ["bug"], assignee: "Ada", priority: 1 }))).toEqual(
      ["Status", "Priority", "3 filters"],
    );
  });
});

describe("issuesConfigDetails", () => {
  it("spells out every axis the one-line summary had to drop", () => {
    expect(
      issuesConfigDetails(
        {
          ...config({
            statuses: ["running"],
            sources: ["linear"],
            labels: ["bug"],
            projects: ["project-1"],
            linearStates: ["In Progress"],
            assignee: "Ada",
            priority: 1,
          }),
          grouping: "label",
          sort: "priority",
        },
        OPTIONS,
      ),
    ).toEqual([
      { label: "Group", value: "Label" },
      { label: "Sort", value: "Priority" },
      { label: "Status", value: "Running" },
      { label: "Sources", value: "Linear" },
      { label: "Labels", value: "bug" },
      { label: "Project", value: "otomat" },
      { label: "Linear state", value: "In Progress" },
      { label: "Assignee", value: "Ada" },
      { label: "Priority", value: "Urgent" },
    ]);
  });

  it("lists the display axes alone when nothing is filtered", () => {
    expect(issuesConfigDetails(config(), OPTIONS)).toEqual([
      { label: "Group", value: "Status" },
      { label: "Sort", value: "Priority" },
    ]);
  });

  it("names an unassigned selection rather than echoing the stored token", () => {
    expect(issuesConfigDetails(config({ assignee: "unassigned" }), OPTIONS)).toContainEqual({
      label: "Assignee",
      value: "Unassigned",
    });
  });

  it("falls back to the stored value when the project no longer offers the option", () => {
    expect(issuesConfigDetails(config({ labels: ["gone"] }), OPTIONS)).toContainEqual({
      label: "Labels",
      value: "gone",
    });
  });
});
