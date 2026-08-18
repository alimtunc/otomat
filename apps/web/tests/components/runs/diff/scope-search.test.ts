import {
  readDiffScopeSearch,
  toDiffScopeSearch,
  toDiffScopeSelector,
} from "@web/components/runs/diff/scope/search";
import { expect, it } from "vitest";

it("reads a commit and a session scope back out of the URL", () => {
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "commit", commit: "abc" }))).toEqual({
    kind: "commit",
    commit: "abc",
  });
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "session", session: "s1" }))).toEqual({
    kind: "session",
    session: "s1",
  });
});

it("round-trips every selector through the search params", () => {
  for (const selector of [
    { kind: "workspace" },
    { kind: "commit", commit: "abc" },
    { kind: "session", session: "s1" },
  ] as const) {
    expect(toDiffScopeSelector(readDiffScopeSearch(toDiffScopeSearch(selector)))).toEqual(selector);
  }
});

it("falls back to the workspace rather than asking for a scope naming nothing", () => {
  expect(toDiffScopeSelector(readDiffScopeSearch({}))).toEqual({ kind: "workspace" });
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "commit" }))).toEqual({
    kind: "workspace",
  });
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "session", session: "" }))).toEqual({
    kind: "workspace",
  });
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "nonsense", commit: "abc" }))).toEqual({
    kind: "workspace",
  });
});

it("drops a value that is not a string, so a crafted URL cannot smuggle one through", () => {
  expect(readDiffScopeSearch({ scope: "commit", commit: 42 })).toEqual({ scope: "commit" });
});
