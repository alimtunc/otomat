import { isProjectRoute, isProjectScopedDetail } from "@web/lib/project-navigation";
import { describe, expect, it } from "vitest";

describe("isProjectScopedDetail", () => {
  it("matches run, issue and pull request detail routes", () => {
    expect(isProjectScopedDetail("/runs/abc123")).toBe(true);
    expect(isProjectScopedDetail("/runs/abc123/diff")).toBe(true);
    expect(isProjectScopedDetail("/runs/abc123/pr")).toBe(true);
    expect(isProjectScopedDetail("/issues/xyz789")).toBe(true);
    expect(isProjectScopedDetail("/pull-requests/pr-1/diff")).toBe(true);
  });

  it("leaves list and section routes in place", () => {
    expect(isProjectScopedDetail("/runs")).toBe(false);
    expect(isProjectScopedDetail("/issues")).toBe(false);
    expect(isProjectScopedDetail("/pull-requests")).toBe(false);
    expect(isProjectScopedDetail("/reviews")).toBe(false);
    expect(isProjectScopedDetail("/settings/repositories")).toBe(false);
    expect(isProjectScopedDetail("/")).toBe(false);
  });
});

describe("isProjectRoute", () => {
  it("matches the views a project answers on its own", () => {
    expect(isProjectRoute("/issues")).toBe(true);
    expect(isProjectRoute("/issues/xyz789")).toBe(true);
    expect(isProjectRoute("/runs/abc123/diff")).toBe(true);
    expect(isProjectRoute("/reviews")).toBe(true);
    expect(isProjectRoute("/pull-requests/pr-1/diff")).toBe(true);
    expect(isProjectRoute("/usage")).toBe(true);
  });

  it("leaves out the views that answer for every project at once", () => {
    expect(isProjectRoute("/inbox")).toBe(false);
    expect(isProjectRoute("/settings/project")).toBe(false);
    expect(isProjectRoute("/agents")).toBe(false);
    expect(isProjectRoute("/issuesomething")).toBe(false);
    expect(isProjectRoute("/")).toBe(false);
  });
});
