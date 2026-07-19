import { isProjectScopedDetail } from "@web/lib/project-navigation";
import { describe, expect, it } from "vitest";

describe("isProjectScopedDetail", () => {
  it("matches run and issue detail routes", () => {
    expect(isProjectScopedDetail("/runs/abc123")).toBe(true);
    expect(isProjectScopedDetail("/runs/abc123/diff")).toBe(true);
    expect(isProjectScopedDetail("/runs/abc123/pr")).toBe(true);
    expect(isProjectScopedDetail("/issues/xyz789")).toBe(true);
  });

  it("leaves list and section routes in place", () => {
    expect(isProjectScopedDetail("/runs")).toBe(false);
    expect(isProjectScopedDetail("/issues")).toBe(false);
    expect(isProjectScopedDetail("/reviews")).toBe(false);
    expect(isProjectScopedDetail("/settings/repositories")).toBe(false);
    expect(isProjectScopedDetail("/")).toBe(false);
  });
});
