import { describe, expect, it } from "vitest";

import {
  commitScopeViolation,
  commitSubjectSchema,
  commitSubjectViolation,
  commitSummaryBudget,
  formatCommitSubject,
  parseCommitSubject,
  shortenCommitSummary,
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

  it("accepts a 72-character subject and refuses the 73rd with what to remove", () => {
    const budget = commitSummaryBudget({ type: "feat", scope: "pr" });

    expect(
      commitSubjectViolation({ type: "feat", scope: "pr", summary: "x".repeat(budget) }),
    ).toBeNull();
    expect(
      commitSubjectViolation({ type: "feat", scope: "pr", summary: "x".repeat(budget + 1) }),
    ).toBe("The subject is 73 characters; remove 1 to stay within 72.");
  });

  it("names the real length and the exact excess of the regression at 80", () => {
    expect(commitSubjectViolation({ type: "feat", scope: "pr", summary: "x".repeat(70) })).toBe(
      "The subject is 80 characters; remove 8 to stay within 72.",
    );
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

describe("commitSummaryBudget", () => {
  it("is the room `type(scope): ` leaves, so a longer scope immediately shrinks it", () => {
    expect(commitSummaryBudget({ type: "feat", scope: null })).toBe(66);
    expect(commitSummaryBudget({ type: "feat", scope: "pr" })).toBe(62);
    expect(commitSummaryBudget({ type: "refactor", scope: "publication" })).toBe(49);
  });

  it("floors at zero rather than going negative for a scope no subject can carry", () => {
    expect(commitSummaryBudget({ type: "refactor", scope: "a".repeat(80) })).toBe(0);
  });
});

describe("shortenCommitSummary", () => {
  it("drops whole trailing words and the punctuation they leave behind", () => {
    expect(
      shortenCommitSummary({
        type: "feat",
        scope: "publication",
        summary: "handle structured runtime questions with choices, plus a free-form answer",
      }),
    ).toBe("handle structured runtime questions with choices");
  });

  it("leaves a summary that already fits exactly as it is", () => {
    expect(shortenCommitSummary({ type: "fix", scope: null, summary: "keep the branch" })).toBe(
      "keep the branch",
    );
  });

  it("folds a summary the contract refused for spanning two lines onto one", () => {
    expect(
      shortenCommitSummary({
        type: "fix",
        scope: null,
        summary: "keep the branch\nand the worktree",
      }),
    ).toBe("keep the branch and the worktree");
  });

  it("never cuts a word in half, answering null when not even the first one fits", () => {
    expect(
      shortenCommitSummary({ type: "refactor", scope: "a".repeat(80), summary: "shorten it" }),
    ).toBeNull();
    expect(
      shortenCommitSummary({ type: "feat", scope: "pr", summary: `${"x".repeat(70)} tail` }),
    ).toBeNull();
  });

  it("repairs what the contract refuses, so the repaired subject passes it", () => {
    const subject = {
      type: "feat",
      scope: "pr",
      summary: "keep the local runs going when the desktop window closes and the tray takes over",
    } as const;
    const summary = shortenCommitSummary(subject);

    expect(summary).not.toBeNull();
    expect(commitSubjectViolation({ ...subject, summary: summary ?? "" })).toBeNull();
  });
});
