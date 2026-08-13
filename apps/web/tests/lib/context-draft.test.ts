import {
  addContextReference,
  contextRequestFields,
  EMPTY_CONTEXT_DRAFT,
  removeContextReference,
} from "@web/lib/context/draft";
import { contextSources } from "@web/lib/context/sources";
import { expect, it } from "vitest";

it("keeps attached references unique and ordered, and removes one by key", () => {
  const withFile = addContextReference(EMPTY_CONTEXT_DRAFT, {
    kind: "file",
    path: "src/parser.ts",
  });
  const withIssue = addContextReference(withFile, { kind: "issue", issue_id: "i-2" });
  const twice = addContextReference(withIssue, { kind: "file", path: "src/parser.ts" });

  expect(twice.references).toEqual([
    { kind: "file", path: "src/parser.ts" },
    { kind: "issue", issue_id: "i-2" },
  ]);
  expect(removeContextReference(twice, "file:src/parser.ts").references).toEqual([
    { kind: "issue", issue_id: "i-2" },
  ]);
});

it("adds no instruction when the note is blank, and trims one that is not", () => {
  expect(contextRequestFields(EMPTY_CONTEXT_DRAFT)).toEqual({});
  expect(contextRequestFields({ ...EMPTY_CONTEXT_DRAFT, note: "   " })).toEqual({});
  expect(contextRequestFields({ ...EMPTY_CONTEXT_DRAFT, note: "  do it  " })).toEqual({
    note: "do it",
  });
});

it("states every source and its provenance before the launch", () => {
  const sources = contextSources({
    draft: {
      references: [
        { kind: "file", path: "src/parser.ts" },
        { kind: "issue", issue_id: "i-2" },
      ],
      note: "keep the API stable",
    },
    issueLabel: "OTO-1",
    profileName: "Reviewer",
    skillNames: ["tdd"],
    dependencyNames: ["Build"],
  });

  expect(sources.map((source) => source.id)).toEqual([
    "issue",
    "issues",
    "files",
    "profile",
    "predecessors",
    "note",
  ]);
  expect(sources[0]?.label).toContain("Issue snapshot attached");
  expect(sources[3]?.label).toBe("Guidance from Reviewer");
  expect(sources[3]?.detail).toBe("skills: tdd");
  expect(sources[4]?.detail).toBe("from Build");
});

it("omits an absent note and names an unprofiled launch honestly", () => {
  const sources = contextSources({
    draft: EMPTY_CONTEXT_DRAFT,
    issueLabel: null,
    profileName: null,
    skillNames: [],
    dependencyNames: [],
  });
  expect(sources).toEqual([
    { id: "profile", label: "No profile guidance", detail: "no skill enabled" },
  ]);
});
