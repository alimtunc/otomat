import { backTarget } from "@web/lib/back-target";
import { describe, expect, it } from "vitest";

describe("backTarget", () => {
  it("sends an issue detail to the issues list", () => {
    expect(backTarget("/issues/issue-1", null)).toEqual({ href: "/issues", label: "Issues" });
  });

  it("sends an agent profile to the agents settings list", () => {
    expect(backTarget("/settings/agents/profile-1", null)).toEqual({
      href: "/settings/agents",
      label: "Agents",
    });
  });

  it("sends a run to the issue it works on", () => {
    expect(backTarget("/runs/run-1", "issue-42")).toEqual({
      href: "/issues/issue-42",
      label: "issue issue-42",
    });
  });

  it("sends a run with no linked issue to the runs list", () => {
    expect(backTarget("/runs/run-1", null)).toEqual({ href: "/runs", label: "Runs" });
  });

  it("sends every run tab to its run, whatever the linked issue is", () => {
    for (const tab of ["diff", "logs", "pr", "report"]) {
      expect(backTarget(`/runs/run-1/${tab}`, "issue-42")).toEqual({
        href: "/runs/run-1",
        label: "run run-1",
      });
    }
  });

  it("sends a pull-request reviewer to the reviews inbox, linked issue or not", () => {
    for (const linkedIssueId of [null, "issue-42"]) {
      expect(backTarget("/pull-requests/pr-1/diff", linkedIssueId)).toEqual({
        href: "/reviews",
        label: "Reviews",
      });
    }
  });

  it("gives list routes no back target", () => {
    for (const pathname of [
      "/issues",
      "/runs",
      "/reviews",
      "/settings/agents",
      "/settings/project",
      "/",
    ]) {
      expect(backTarget(pathname, "issue-42")).toBeNull();
    }
  });
});
