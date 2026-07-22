import { expect, it } from "vitest";

import { parseFrontmatter } from "#agents/skills/frontmatter";

it("parses name and description from a frontmatter block", () => {
  const parsed = parseFrontmatter("---\nname: foo\ndescription: does things\n---\n\n# Body");
  expect(parsed).toEqual({ name: "foo", description: "does things" });
});

it("returns null when there is no frontmatter block", () => {
  expect(parseFrontmatter("# Just a body")).toBeNull();
});

it("returns null when the frontmatter block is not terminated", () => {
  expect(parseFrontmatter("---\nname: foo\nno closing delimiter")).toBeNull();
});

it("reports a missing name as a null name", () => {
  expect(parseFrontmatter("---\ndescription: only desc\n---\n")).toEqual({
    name: null,
    description: "only desc",
  });
});

it("strips surrounding quotes from a value", () => {
  expect(parseFrontmatter('---\nname: "quoted"\n---\n')?.name).toBe("quoted");
});
