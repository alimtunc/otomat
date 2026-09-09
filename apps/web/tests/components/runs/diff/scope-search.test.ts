import { runDiffScopeParams } from "@otomat/domain";
import { readDiffScopeSearch, toDiffScopeSelector } from "@web/components/runs/diff/scope/search";
import { expect, it } from "vitest";

it("reads every named scope back out of the URL", () => {
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "commit", commit: "abc" }))).toEqual({
    kind: "commit",
    commit: "abc",
  });
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "step", step: "st1" }))).toEqual({
    kind: "step",
    step: "st1",
  });
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "session", session: "s1" }))).toEqual({
    kind: "session",
    session: "s1",
  });
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "pull_request" }))).toEqual({
    kind: "pull_request",
  });
});

it("round-trips every selector through the search params", () => {
  for (const selector of [
    { kind: "default" },
    { kind: "branch" },
    { kind: "commit", commit: "abc" },
    { kind: "step", step: "st1" },
    { kind: "session", session: "s1" },
    { kind: "pull_request" },
  ] as const) {
    expect(toDiffScopeSelector(readDiffScopeSearch(runDiffScopeParams(selector)))).toEqual(
      selector,
    );
  }
});

it("clears the key the previous scope named when the next one does not use it", () => {
  const moved = {
    scope: "commit",
    commit: "abc",
    ...runDiffScopeParams({ kind: "step", step: "st1" }),
  };

  expect(moved.commit).toBeUndefined();
  expect(toDiffScopeSelector(moved)).toEqual({ kind: "step", step: "st1" });
});

it("falls back to the subject's default rather than asking for a scope naming nothing", () => {
  expect(toDiffScopeSelector(readDiffScopeSearch({}))).toEqual({ kind: "default" });
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "commit" }))).toEqual({
    kind: "default",
  });
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "step", step: "" }))).toEqual({
    kind: "default",
  });
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "nonsense", commit: "abc" }))).toEqual({
    kind: "default",
  });
});

it("keeps an explicitly chosen branch scope, so it is not re-read as the default", () => {
  expect(toDiffScopeSelector(readDiffScopeSearch({ scope: "branch" }))).toEqual({ kind: "branch" });
  expect(runDiffScopeParams({ kind: "branch" }).scope).toBe("branch");
  expect(runDiffScopeParams({ kind: "default" }).scope).toBeUndefined();
});

it("drops a value that is not a string, so a crafted URL cannot smuggle one through", () => {
  expect(readDiffScopeSearch({ scope: "commit", commit: 42 })).toEqual({ scope: "commit" });
});
