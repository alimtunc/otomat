import {
  assigneeOptions,
  labelOptions,
  linearStateOptions,
  projectOptions,
} from "@web/lib/issue/filter-options";
import { describe, expect, it } from "vitest";

import { issueContract, linearIssueContract } from "#support/issue";

const ISSUES = [
  linearIssueContract({
    id: "a",
    source_assignee_name: "Fawsy",
    source_labels: [{ name: "ui", color: "#0f0" }],
    source_state_name: "In Progress",
    source_state_color: "#facc15",
  }),
  linearIssueContract({
    id: "b",
    source_assignee_name: "Alim",
    source_labels: [
      { name: "bug", color: "#f00" },
      { name: "ui", color: "#00f" },
    ],
    source_state_name: "In Progress",
    source_state_color: "#000",
  }),
  linearIssueContract({ id: "c", source_assignee_name: "Alim" }),
  issueContract({ id: "d", project_id: "project-2" }),
];

describe("issue filter options", () => {
  it("lists distinct sorted assignees and ignores unassigned issues", () => {
    expect(assigneeOptions(ISSUES)).toEqual([
      { value: "Alim", label: "Alim" },
      { value: "Fawsy", label: "Fawsy" },
    ]);
  });

  it("lists each label once, keeping the first colour seen", () => {
    expect(labelOptions(ISSUES)).toEqual([
      { value: "bug", label: "bug", color: "#f00" },
      { value: "ui", label: "ui", color: "#0f0" },
    ]);
  });

  it("lists each Linear state once, with a fallback colour", () => {
    expect(linearStateOptions(ISSUES)).toEqual([
      { value: "In Progress", label: "In Progress", color: "#facc15" },
    ]);
    expect(
      linearStateOptions([linearIssueContract({ source_state_name: "Triage" })])[0].color,
    ).toBe("var(--text-tertiary)");
  });

  it("names each project the issues belong to and falls back to a short id", () => {
    expect(projectOptions(ISSUES, new Map([["project-1", "Otomat"]]))).toEqual([
      { value: "project-1", label: "Otomat" },
      { value: "project-2", label: "project-" },
    ]);
  });
});
