import { describe, expect, it } from "vitest";

import { GitCommandError, runGit } from "./git-cli.js";
import { setupTestRepo } from "./test-support.js";

describe("runGit", () => {
  it("returns trimmed stdout and exit code of a successful command", () => {
    const repo = setupTestRepo();
    try {
      const res = runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repo.root });
      expect(res.stdout.trim()).toBe("main");
      expect(res.exitCode).toBe(0);
    } finally {
      repo.cleanup();
    }
  });

  it("throws GitCommandError carrying stderr on a failing command", () => {
    const repo = setupTestRepo();
    try {
      expect(() => runGit(["rev-parse", "definitely-not-a-ref"], { cwd: repo.root })).toThrow(
        GitCommandError,
      );
    } finally {
      repo.cleanup();
    }
  });

  it("returns the failing result instead of throwing when allowFailure is set", () => {
    const repo = setupTestRepo();
    try {
      const res = runGit(["rev-parse", "--verify", "--quiet", "refs/heads/missing"], {
        cwd: repo.root,
        allowFailure: true,
      });
      expect(res.exitCode).not.toBe(0);
    } finally {
      repo.cleanup();
    }
  });
});
