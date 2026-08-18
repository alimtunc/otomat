import { describe, expect, it } from "vitest";

import {
  commitScopeViolation,
  commitSubjectSchema,
  commitSubjectViolation,
  formatCommitSubject,
  parseCommitSubject,
} from "#domain/contracts/commit-subject";

describe("formatCommitSubject", () => {
  it("writes the scope only when the change names one", () => {
    expect(
      formatCommitSubject({ type: "refactor", scope: "launch", summary: "unify the composers" }),
    ).toBe("refactor(launch): unify the composers");
    expect(formatCommitSubject({ type: "chore", scope: null, summary: "tidy the worktree" })).toBe(
      "chore: tidy the worktree",
    );
  });
});

describe("commitSubjectViolation", () => {
  it("accepts an imperative summary within the subject budget", () => {
    expect(
      commitSubjectViolation({ type: "feat", scope: "pr", summary: "publish in one action" }),
    ).toBeNull();
  });

  it("refuses a summary the composed subject cannot hold", () => {
    expect(
      commitSubjectViolation({ type: "feat", scope: "pr", summary: "x".repeat(70) }),
    ).toContain("72");
  });

  it("refuses an empty summary, a second line and a full stop", () => {
    expect(commitSubjectViolation({ type: "fix", scope: null, summary: "  " })).toContain(
      "required",
    );
    expect(commitSubjectViolation({ type: "fix", scope: null, summary: "one\ntwo" })).toContain(
      "single line",
    );
    expect(
      commitSubjectViolation({ type: "fix", scope: null, summary: "prioritize the board." }),
    ).toContain("full stop");
  });

  it("refuses a scope no subject could carry", () => {
    expect(commitScopeViolation("two words")).toContain("lowercase");
    expect(commitScopeViolation("(nested)")).toContain("lowercase");
    expect(commitScopeViolation("data-safety")).toBeNull();
    expect(commitScopeViolation("")).toBeNull();
  });
});

describe("commitSubjectSchema", () => {
  it("refuses a type the repository does not publish", () => {
    expect(
      commitSubjectSchema.safeParse({ type: "wip", scope: null, summary: "keep going" }).success,
    ).toBe(false);
  });

  it("carries the subject budget into the boundary, not only into the form", () => {
    const parsed = commitSubjectSchema.safeParse({
      type: "refactor",
      scope: "launch",
      summary: "share one launch composer and give the workflow one global row",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("parseCommitSubject", () => {
  it("reads back a subject Otomat composed", () => {
    expect(parseCommitSubject("refactor(launch): unify run and workflow composers")).toEqual({
      type: "refactor",
      scope: "launch",
      summary: "unify run and workflow composers",
    });
    expect(parseCommitSubject("chore: tidy the worktree")).toEqual({
      type: "chore",
      scope: null,
      summary: "tidy the worktree",
    });
  });

  it("reads nothing back from a subject this contract would not have written", () => {
    expect(parseCommitSubject("Share one launch composer")).toBeNull();
    expect(parseCommitSubject("wip(pr): keep going")).toBeNull();
    expect(parseCommitSubject("")).toBeNull();
  });
});
