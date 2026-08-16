import { DEFAULT_ISSUES_LAYOUT, readIssuesLayout, writeIssuesLayout } from "@web/lib/issue/layout";
import { expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

it("restores the last layout a project was displayed with", () => {
  const storage = memoryStorage();
  expect(readIssuesLayout("project-1", storage)).toBe(DEFAULT_ISSUES_LAYOUT);

  writeIssuesLayout("project-1", "list", storage);
  expect(readIssuesLayout("project-1", storage)).toBe("list");
});

it("keeps one project's layout out of another's", () => {
  const storage = memoryStorage();
  writeIssuesLayout("project-1", "list", storage);
  expect(readIssuesLayout("project-2", storage)).toBe("board");
});

it("falls back to the default for a value no toggle could have written", () => {
  const storage = memoryStorage();
  storage.setItem("otomat.issue-layout", '{"project-1":"grid"}');
  expect(readIssuesLayout("project-1", storage)).toBe(DEFAULT_ISSUES_LAYOUT);
});
