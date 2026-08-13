import {
  assigneeOptions,
  labelOptions,
  linearStateOptions,
  projectOptions,
  type IssueFilterOptions,
} from "@web/lib/issue/filter-options";
import { NO_ADVANCED_FILTERS } from "@web/lib/issue/filters";
import { unmatchedFilterValues } from "@web/lib/issue/invalid-filters";
import { describe, expect, it } from "vitest";

import { linearIssueContract } from "#support/issue";

function optionsFor(issues: Parameters<typeof assigneeOptions>[0]): IssueFilterOptions {
  return {
    assignees: assigneeOptions(issues),
    linearStates: linearStateOptions(issues),
    labels: labelOptions(issues),
    projects: projectOptions(issues, new Map()),
  };
}

const OPTIONS = optionsFor([
  linearIssueContract({
    id: "a",
    source_assignee_name: "Ada",
    source_labels: [{ name: "bug", color: "#f00" }],
    source_state_name: "In Progress",
    source_state_color: "#facc15",
  }),
]);

describe("unmatchedFilterValues", () => {
  it("says nothing while every selected value still exists", () => {
    expect(
      unmatchedFilterValues(
        { ...NO_ADVANCED_FILTERS, labels: ["bug"], assignee: "Ada", linearStates: ["In Progress"] },
        OPTIONS,
      ),
    ).toEqual([]);
  });

  it("names each value the project no longer carries", () => {
    expect(
      unmatchedFilterValues(
        {
          ...NO_ADVANCED_FILTERS,
          labels: ["bug", "chore"],
          linearStates: ["Triage"],
          projects: ["project-9"],
          assignee: "Grace",
        },
        OPTIONS,
      ),
    ).toEqual(["Label chore", "State Triage", "Project project-9", "Assignee Grace"]);
  });

  it("stays silent on the closed axes and on the two assignee sentinels", () => {
    expect(
      unmatchedFilterValues(
        {
          ...NO_ADVANCED_FILTERS,
          statuses: ["canceled"],
          sources: ["github"],
          priority: 4,
          assignee: "unassigned",
        },
        OPTIONS,
      ),
    ).toEqual([]);
  });

  it("claims nothing when there is no issue to compare against", () => {
    expect(
      unmatchedFilterValues({ ...NO_ADVANCED_FILTERS, labels: ["bug"] }, optionsFor([])),
    ).toEqual([]);
  });
});
