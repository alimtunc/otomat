import { describe, expect, it } from "vitest";

import {
  baseBranchForkPoint,
  branchExists,
  headSha,
  mergeBase,
  revParse,
  unpushedCommitCount,
} from "#git/repo";

import { setupTestRepo } from "../support/git.js";

describe("repo primitives", () => {
  it("baseBranchForkPoint follows the remote tip a local base branch has fallen behind", () => {
    const repo = setupTestRepo();
    try {
      repo.git("checkout", "--quiet", "-b", "ahead");
      repo.write("published.md", "landed upstream\n");
      const upstream = repo.commitAll("upstream moves on");
      repo.git("push", "--quiet", "origin", "ahead:main");
      repo.git("checkout", "--quiet", "-b", "feature");
      repo.write("feature.md", "branch work\n");
      const tip = repo.commitAll("feature");
      repo.git("checkout", "--quiet", "main");
      repo.git("fetch", "--quiet", "origin");

      expect(revParse(repo.root, "main")).not.toBe(upstream);
      expect(mergeBase(repo.root, "main", tip)).not.toBe(upstream);
      expect(baseBranchForkPoint(repo.root, "main", tip)).toBe(upstream);
    } finally {
      repo.cleanup();
    }
  });

  it("baseBranchForkPoint reads the single remote when the base branch tracks nothing", () => {
    const repo = setupTestRepo();
    try {
      repo.git("checkout", "--quiet", "-b", "ahead");
      repo.write("published.md", "landed upstream\n");
      const upstream = repo.commitAll("upstream moves on");
      repo.git("push", "--quiet", "origin", "ahead:main");
      repo.git("checkout", "--quiet", "-b", "feature");
      repo.write("feature.md", "branch work\n");
      const tip = repo.commitAll("feature");
      repo.git("checkout", "--quiet", "main");
      repo.git("fetch", "--quiet", "origin");
      repo.git("config", "--unset", "branch.main.remote");
      repo.git("config", "--unset", "branch.main.merge");

      expect(baseBranchForkPoint(repo.root, "main", tip)).toBe(upstream);
    } finally {
      repo.cleanup();
    }
  });

  it("baseBranchForkPoint keeps the fork point once the remote already carries the branch", () => {
    const repo = setupTestRepo();
    try {
      const forkPoint = revParse(repo.root, "main");
      repo.git("checkout", "--quiet", "-b", "feature");
      repo.write("feature.md", "branch work\n");
      const tip = repo.commitAll("feature");
      repo.git("push", "--quiet", "origin", "feature:main");
      repo.git("checkout", "--quiet", "main");
      repo.git("fetch", "--quiet", "origin");

      expect(mergeBase(repo.root, "origin/main", tip)).toBe(tip);
      expect(baseBranchForkPoint(repo.root, "main", tip)).toBe(forkPoint);
    } finally {
      repo.cleanup();
    }
  });

  it("baseBranchForkPoint ignores a base branch tracking a local branch, which publishes nothing", () => {
    const repo = setupTestRepo();
    try {
      const forkPoint = revParse(repo.root, "main");
      repo.git("checkout", "--quiet", "-b", "staging");
      repo.write("staged.md", "not on main\n");
      const staged = repo.commitAll("staging moves on");
      repo.git("checkout", "--quiet", "-b", "feature");
      repo.write("feature.md", "branch work\n");
      const tip = repo.commitAll("feature");
      repo.git("checkout", "--quiet", "main");
      repo.git("branch", "--set-upstream-to=staging", "main");

      expect(mergeBase(repo.root, "staging", tip)).toBe(staged);
      expect(baseBranchForkPoint(repo.root, "main", tip)).toBe(forkPoint);
    } finally {
      repo.cleanup();
    }
  });

  it("baseBranchForkPoint keeps the local tip when the base branch is ahead of its upstream", () => {
    const repo = setupTestRepo();
    try {
      repo.write("local-only.md", "not pushed yet\n");
      const localTip = repo.commitAll("main moves on locally");
      repo.git("checkout", "--quiet", "-b", "feature");
      repo.write("feature.md", "branch work\n");
      const tip = repo.commitAll("feature");
      repo.git("checkout", "--quiet", "main");

      expect(baseBranchForkPoint(repo.root, "main", tip)).toBe(localTip);
    } finally {
      repo.cleanup();
    }
  });

  it("baseBranchForkPoint answers from the local branch alone when nothing tracks a remote", () => {
    const repo = setupTestRepo({ withoutRemote: true });
    try {
      const base = revParse(repo.root, "main");
      repo.git("checkout", "--quiet", "-b", "feature");
      repo.write("feature.md", "branch work\n");
      const tip = repo.commitAll("feature");

      expect(baseBranchForkPoint(repo.root, "main", tip)).toBe(base);
    } finally {
      repo.cleanup();
    }
  });

  it("headSha matches rev-parse HEAD", () => {
    const repo = setupTestRepo();
    try {
      expect(headSha(repo.root)).toBe(repo.git("rev-parse", "HEAD").trim());
    } finally {
      repo.cleanup();
    }
  });

  it("revParse resolves a ref to a sha", () => {
    const repo = setupTestRepo();
    try {
      expect(revParse(repo.root, "main")).toBe(repo.git("rev-parse", "main").trim());
    } finally {
      repo.cleanup();
    }
  });

  it("unpushedCommitCount counts only what deleting the branch would lose", () => {
    const repo = setupTestRepo();
    try {
      repo.git("checkout", "-b", "feature");
      repo.write("a.txt", "a");
      repo.commitAll("feat: only here");

      expect(unpushedCommitCount(repo.root, "feature")).toBe(1);

      repo.git("branch", "keeper", "feature");

      expect(unpushedCommitCount(repo.root, "feature")).toBe(0);
    } finally {
      repo.cleanup();
    }
  });

  it("mergeBase finds the fork point of a divergent branch", () => {
    const repo = setupTestRepo();
    try {
      const forkPoint = headSha(repo.root);
      repo.git("checkout", "-b", "feature");
      repo.write("a.txt", "hi");
      repo.commitAll("feat");
      expect(mergeBase(repo.root, "feature", "main")).toBe(forkPoint);
    } finally {
      repo.cleanup();
    }
  });

  it("mergeBase returns null for unrelated histories", () => {
    const repo = setupTestRepo();
    try {
      repo.git("checkout", "--orphan", "orphan");
      repo.write("b.txt", "x");
      repo.commitAll("orphan root");
      expect(mergeBase(repo.root, "orphan", "main")).toBeNull();
    } finally {
      repo.cleanup();
    }
  });

  it("branchExists reflects ref presence", () => {
    const repo = setupTestRepo();
    try {
      expect(branchExists(repo.root, "main")).toBe(true);
      expect(branchExists(repo.root, "nope")).toBe(false);
    } finally {
      repo.cleanup();
    }
  });
});
