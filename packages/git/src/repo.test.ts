import { describe, expect, it } from "vitest";

import { branchExists, headSha, mergeBase, revParse } from "./repo.js";
import { setupTestRepo } from "./test-support.js";

describe("repo primitives", () => {
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
