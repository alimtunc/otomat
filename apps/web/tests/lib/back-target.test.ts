import { backTarget } from "@web/lib/back-target";
import { describe, expect, it } from "vitest";

describe("backTarget", () => {
  it("sends an issue detail to the issues list", () => {
    expect(backTarget("/issues/issue-1", null)).toEqual({ href: "/issues", label: "Issues" });
  });

  it("sends an agent profile to the agents list", () => {
    expect(backTarget("/agents/profile-1", null)).toEqual({ href: "/agents", label: "Agents" });
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

  it("gives list routes no back target", () => {
    for (const pathname of ["/issues", "/runs", "/agents", "/reviews", "/settings/project", "/"]) {
      expect(backTarget(pathname, "issue-42")).toBeNull();
    }
  });
});
