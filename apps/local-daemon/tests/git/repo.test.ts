import { describe, expect, it } from "vitest";

import { branchExists } from "#git/branches";
import { baseBranchForkPoint, headSha, mergeBase, revParse, unpushedCommitCount } from "#git/repo";

import { setupTestRepo } from "../support/git.js";

describe("repo primitives", () => {
  it("baseBranchForkPoint follows the remote tip a local base branch has fallen behind", async () => {
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

      expect(await revParse(repo.root, "main")).not.toBe(upstream);
      expect(await mergeBase(repo.root, "main", tip)).not.toBe(upstream);
      expect(await baseBranchForkPoint(repo.root, "main", tip)).toBe(upstream);
    } finally {
      repo.cleanup();
    }
  });

  it("baseBranchForkPoint reads the single remote when the base branch tracks nothing", async () => {
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

      expect(await baseBranchForkPoint(repo.root, "main", tip)).toBe(upstream);
    } finally {
      repo.cleanup();
    }
  });

  it("baseBranchForkPoint keeps the fork point once the remote already carries the branch", async () => {
    const repo = setupTestRepo();
    try {
      const forkPoint = await revParse(repo.root, "main");
      repo.git("checkout", "--quiet", "-b", "feature");
      repo.write("feature.md", "branch work\n");
      const tip = repo.commitAll("feature");
      repo.git("push", "--quiet", "origin", "feature:main");
      repo.git("checkout", "--quiet", "main");
      repo.git("fetch", "--quiet", "origin");

      expect(await mergeBase(repo.root, "origin/main", tip)).toBe(tip);
      expect(await baseBranchForkPoint(repo.root, "main", tip)).toBe(forkPoint);
    } finally {
      repo.cleanup();
    }
  });

  it("baseBranchForkPoint ignores a base branch tracking a local branch, which publishes nothing", async () => {
    const repo = setupTestRepo();
    try {
      const forkPoint = await revParse(repo.root, "main");
      repo.git("checkout", "--quiet", "-b", "staging");
      repo.write("staged.md", "not on main\n");
      const staged = repo.commitAll("staging moves on");
      repo.git("checkout", "--quiet", "-b", "feature");
      repo.write("feature.md", "branch work\n");
      const tip = repo.commitAll("feature");
      repo.git("checkout", "--quiet", "main");
      repo.git("branch", "--set-upstream-to=staging", "main");

      expect(await mergeBase(repo.root, "staging", tip)).toBe(staged);
      expect(await baseBranchForkPoint(repo.root, "main", tip)).toBe(forkPoint);
    } finally {
      repo.cleanup();
    }
  });

  it("baseBranchForkPoint keeps the local tip when the base branch is ahead of its upstream", async () => {
    const repo = setupTestRepo();
    try {
      repo.write("local-only.md", "not pushed yet\n");
      const localTip = repo.commitAll("main moves on locally");
      repo.git("checkout", "--quiet", "-b", "feature");
      repo.write("feature.md", "branch work\n");
      const tip = repo.commitAll("feature");
      repo.git("checkout", "--quiet", "main");

      expect(await baseBranchForkPoint(repo.root, "main", tip)).toBe(localTip);
    } finally {
      repo.cleanup();
    }
  });

  it("baseBranchForkPoint answers from the local branch alone when nothing tracks a remote", async () => {
    const repo = setupTestRepo({ withoutRemote: true });
    try {
      const base = await revParse(repo.root, "main");
      repo.git("checkout", "--quiet", "-b", "feature");
      repo.write("feature.md", "branch work\n");
      const tip = repo.commitAll("feature");

      expect(await baseBranchForkPoint(repo.root, "main", tip)).toBe(base);
    } finally {
      repo.cleanup();
    }
  });

  it("headSha matches rev-parse HEAD", async () => {
    const repo = setupTestRepo();
    try {
      expect(await headSha(repo.root)).toBe(repo.git("rev-parse", "HEAD").trim());
    } finally {
      repo.cleanup();
    }
  });

  it("revParse resolves a ref to a sha", async () => {
    const repo = setupTestRepo();
    try {
      expect(await revParse(repo.root, "main")).toBe(repo.git("rev-parse", "main").trim());
    } finally {
      repo.cleanup();
    }
  });

  it("unpushedCommitCount counts only what deleting the branch would lose", async () => {
    const repo = setupTestRepo();
    try {
      repo.git("checkout", "-b", "feature");
      repo.write("a.txt", "a");
      repo.commitAll("feat: only here");

      expect(await unpushedCommitCount(repo.root, "feature")).toBe(1);

      repo.git("branch", "keeper", "feature");

      expect(await unpushedCommitCount(repo.root, "feature")).toBe(0);
    } finally {
      repo.cleanup();
    }
  });

  it("mergeBase finds the fork point of a divergent branch", async () => {
    const repo = setupTestRepo();
    try {
      const forkPoint = await headSha(repo.root);
      repo.git("checkout", "-b", "feature");
      repo.write("a.txt", "hi");
      repo.commitAll("feat");
      expect(await mergeBase(repo.root, "feature", "main")).toBe(forkPoint);
    } finally {
      repo.cleanup();
    }
  });

  it("mergeBase returns null for unrelated histories", async () => {
    const repo = setupTestRepo();
    try {
      repo.git("checkout", "--orphan", "orphan");
      repo.write("b.txt", "x");
      repo.commitAll("orphan root");
      expect(await mergeBase(repo.root, "orphan", "main")).toBeNull();
    } finally {
      repo.cleanup();
    }
  });

  it("branchExists reflects ref presence", async () => {
    const repo = setupTestRepo();
    try {
      expect(await branchExists(repo.root, "main")).toBe(true);
      expect(await branchExists(repo.root, "nope")).toBe(false);
    } finally {
      repo.cleanup();
    }
  });
});
