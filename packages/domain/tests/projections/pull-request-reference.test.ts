import { expect, it } from "vitest";

import {
  findIssueReferences,
  matchIssueReference,
  type IssueReferenceSurfaces,
} from "#domain/projections/pull-request-reference";

function surfaces(overrides: Partial<IssueReferenceSurfaces> = {}): IssueReferenceSurfaces {
  return { title: "", body: null, branch: null, ...overrides };
}

it("refuses the tokens GitHub splits an identifier into", () => {
  const tokenized = surfaces({
    title: "fix(supervisor): reconcile pids",
    body: "Refs OTO-10\n\nThe daemon 119 tests still pass.",
    branch: "oto-10-supervisor-pid-reconciliation",
  });

  expect(matchIssueReference("OTO-119", tokenized)).toBeNull();
  expect(findIssueReferences(tokenized).map((reference) => reference.identifier)).toEqual([
    "OTO-10",
    "oto-10",
  ]);
});

it("reads the identifier as a value, never as a prefix or an infix", () => {
  expect(matchIssueReference("OTO-119", surfaces({ title: "Fixes OTO-1190" }))).toBeNull();
  expect(matchIssueReference("OTO-119", surfaces({ title: "see xOTO-119" }))).toBeNull();
  expect(matchIssueReference("OTO-119", surfaces({ title: "port of OTO-10-119" }))).toBeNull();
  expect(matchIssueReference("OTO-119", surfaces({ title: "Fixes OTO-119." }))).not.toBeNull();
});

it("names the surface and the text each supported reference was read from", () => {
  expect(
    matchIssueReference("OTO-119", surfaces({ title: "feat(lint): OTO-119 anti-slop" })),
  ).toMatchObject({
    surface: "title",
    excerpt: "feat(lint): OTO-119 anti-slop",
  });
  expect(
    matchIssueReference(
      "OTO-119",
      surfaces({ title: "Anti-slop", body: "## Why\n\nRefs OTO-119" }),
    ),
  ).toMatchObject({ surface: "body", excerpt: "Refs OTO-119" });
  expect(
    matchIssueReference("OTO-119", surfaces({ title: "Anti-slop", branch: "feat/OTO-119-lint" })),
  ).toMatchObject({ surface: "branch", excerpt: "feat/OTO-119-lint" });
});

it("compares case-insensitively, then quotes the identifier back as it was asked for", () => {
  expect(matchIssueReference("OTO-119", surfaces({ branch: "feat/oto-119-lint" }))).toEqual({
    identifier: "OTO-119",
    surface: "branch",
    excerpt: "feat/oto-119-lint",
  });
});

it("prefers the title, then the body, then the branch, so one pull request answers once", () => {
  const everywhere = surfaces({
    title: "OTO-119: vendor anti-slop",
    body: "Refs OTO-119",
    branch: "feat/OTO-119",
  });

  expect(matchIssueReference("OTO-119", everywhere)?.surface).toBe("title");
  expect(findIssueReferences(everywhere).map((reference) => reference.surface)).toEqual([
    "title",
    "body",
    "branch",
  ]);
});

it("trims a long body line to a readable excerpt", () => {
  const line = `Refs OTO-119 ${"context ".repeat(40)}`;

  const match = matchIssueReference("OTO-119", surfaces({ body: line }));

  expect(match?.excerpt.startsWith("Refs OTO-119 context")).toBe(true);
  expect(match?.excerpt.endsWith("…")).toBe(true);
});

it("keeps the identifier inside the excerpt when the line runs long before it", () => {
  const line = `This reverts ${"deadbeef ".repeat(20)}after the release cut. Refs OTO-119 and nothing else.`;

  const match = matchIssueReference("OTO-119", surfaces({ body: line }));

  expect(match?.excerpt).toContain("OTO-119");
  expect(match?.excerpt.startsWith("…")).toBe(true);
});
