import { describe, expect, it } from "vitest";

import { detectCommitConvention, subjectViolation } from "#github";

import { setupTestRepo, type TestRepo } from "../support/git.js";

function commitSubjects(repo: TestRepo, subjects: string[]): void {
  for (const [index, subject] of subjects.entries()) {
    repo.write(`file-${String(index)}.txt`, subject);
    repo.commitAll(subject);
  }
}

describe("subjectViolation", () => {
  it("accepts a conventional subject under the conventional habit", () => {
    expect(subjectViolation("conventional", "fix(board): prioritize completed issues")).toBeNull();
  });

  it("refuses a free-form subject under the conventional habit", () => {
    expect(subjectViolation("conventional", "Prioritize completed issues")).toContain(
      "Conventional Commits",
    );
  });

  it("imposes no shape where the history shows none", () => {
    expect(subjectViolation("free_form", "Prioritize completed issues")).toBeNull();
  });

  it("refuses a subject no repository would take, whatever its habit", () => {
    expect(subjectViolation("free_form", "x".repeat(80))).toContain("72");
    expect(subjectViolation("free_form", "two\nlines")).toContain("single line");
  });
});

describe("detectCommitConvention", () => {
  it("reads the convention from the repository's own subjects", () => {
    const repo = setupTestRepo();
    try {
      commitSubjects(repo, [
        "feat(pr): compact publication",
        "fix(board): prioritize completed issues",
        "chore(deps): bump vitest",
        "refactor(api): split the routes",
        "docs(readme): describe the cockpit",
      ]);

      expect(detectCommitConvention(repo.root, "HEAD")).toMatchObject({
        convention: "conventional",
      });
    } finally {
      repo.cleanup();
    }
  });

  it("imposes nothing on a history that carries no habit", () => {
    const repo = setupTestRepo();
    try {
      commitSubjects(repo, [
        "Add the cockpit",
        "Fix the board",
        "Bump vitest",
        "Split the routes",
        "Describe the cockpit",
      ]);

      expect(detectCommitConvention(repo.root, "HEAD").convention).toBe("free_form");
    } finally {
      repo.cleanup();
    }
  });

  it("claims no convention from too little evidence", () => {
    const repo = setupTestRepo();
    try {
      commitSubjects(repo, ["feat(pr): compact publication"]);

      expect(detectCommitConvention(repo.root, "HEAD").convention).toBe("free_form");
    } finally {
      repo.cleanup();
    }
  });
});
