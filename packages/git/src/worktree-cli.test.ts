import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setupTestRepo, type TestRepo } from "./test-support.js";
import { addWorktree, listWorktrees, pruneWorktrees, removeWorktree } from "./worktree-cli.js";

describe("worktree-cli", () => {
  let repo: TestRepo;
  let wtRoot: string;

  beforeEach(() => {
    repo = setupTestRepo();
    wtRoot = mkdtempSync(join(tmpdir(), "otomat-wt-"));
  });

  afterEach(() => {
    rmSync(wtRoot, { recursive: true, force: true });
    repo.cleanup();
  });

  it("adds a worktree on a new branch checked out from a base ref", () => {
    const wtPath = join(wtRoot, "a");
    addWorktree(repo.root, { worktreePath: wtPath, branch: "feat-a", baseRef: "main" });

    expect(existsSync(join(wtPath, "README.md"))).toBe(true);
    const entries = listWorktrees(repo.root);
    expect(entries.some((e) => e.branch === "feat-a")).toBe(true);
  });

  it("removes a worktree and leaves no orphan entry", () => {
    const wtPath = join(wtRoot, "b");
    addWorktree(repo.root, { worktreePath: wtPath, branch: "feat-b", baseRef: "main" });
    removeWorktree(repo.root, wtPath);
    pruneWorktrees(repo.root);

    expect(existsSync(wtPath)).toBe(false);
    expect(listWorktrees(repo.root).some((e) => e.branch === "feat-b")).toBe(false);
  });

  it("rejects two worktrees on the same branch", () => {
    addWorktree(repo.root, { worktreePath: join(wtRoot, "c1"), branch: "feat-c", baseRef: "main" });
    expect(() =>
      addWorktree(repo.root, {
        worktreePath: join(wtRoot, "c2"),
        branch: "feat-c",
        baseRef: "main",
      }),
    ).toThrow();
  });

  it("tolerates removing an already-removed worktree", () => {
    const wtPath = join(wtRoot, "idem");
    addWorktree(repo.root, { worktreePath: wtPath, branch: "feat-idem", baseRef: "main" });
    removeWorktree(repo.root, wtPath);
    expect(() => removeWorktree(repo.root, wtPath)).not.toThrow();
    pruneWorktrees(repo.root);
    expect(listWorktrees(repo.root).some((e) => e.branch === "feat-idem")).toBe(false);
  });
});
