import { describe, expect, it } from "vitest";

import { commitMessage, pullRequestBody, pullRequestTitle } from "#github";

describe("pullRequestTitle", () => {
  it("names the issue the run delivers", () => {
    expect(pullRequestTitle("refactor(launch): unify run and workflow composers", "OTO-111")).toBe(
      "refactor(launch): unify run and workflow composers (OTO-111)",
    );
  });

  it("leaves a local issue's title as the subject alone", () => {
    expect(pullRequestTitle("chore: tidy the worktree", null)).toBe("chore: tidy the worktree");
  });

  it("names the issue once, whatever summary the operator wrote", () => {
    expect(pullRequestTitle("fix(pr): validate the subject (OTO-114)", "OTO-114")).toBe(
      "fix(pr): validate the subject (OTO-114)",
    );
  });
});

describe("commitMessage", () => {
  it("refs the issue in a footer, never closing it from a commit", () => {
    expect(commitMessage("refactor(launch): unify composers", null, "OTO-111")).toBe(
      "refactor(launch): unify composers\n\nRefs OTO-111",
    );
  });

  it("keeps the body between the subject and the footer", () => {
    expect(commitMessage("fix(pr): validate the subject", "One paragraph.", "OTO-114")).toBe(
      "fix(pr): validate the subject\n\nOne paragraph.\n\nRefs OTO-114",
    );
  });

  it("writes no footer for an issue with no identifier", () => {
    expect(commitMessage("chore: tidy the worktree", null, null)).toBe("chore: tidy the worktree");
  });
});

describe("pullRequestBody", () => {
  it("closes the issue only when the delivery is complete", () => {
    expect(pullRequestBody("Summary.", "OTO-114", "complete")).toBe("Summary.\n\nFixes OTO-114");
    expect(pullRequestBody("Summary.", "OTO-114", "partial")).toBe("Summary.\n\nRefs OTO-114");
  });

  it("adds no second footer to a body that already carries one", () => {
    expect(pullRequestBody("Summary.\n\nFixes OTO-114", "OTO-114", "complete")).toBe(
      "Summary.\n\nFixes OTO-114",
    );
  });
});
