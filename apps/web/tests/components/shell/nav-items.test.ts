import { sectionForPath } from "@web/components/shell/nav-items";
import { expect, it } from "vitest";

it("derives the active section from the route, so the persistent sidebar follows navigation", () => {
  expect(sectionForPath("/issues/issue-1")).toBe("issues");
  expect(sectionForPath("/runs/run-1/diff")).toBe("runs");
  expect(sectionForPath("/pull-requests/pr-1/overview")).toBe("reviews");
  expect(sectionForPath("/settings/project/agents")).toBe("settings");
  expect(sectionForPath("/")).toBeNull();
});
