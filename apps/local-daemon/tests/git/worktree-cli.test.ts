import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { addWorktree, listWorktrees, pruneWorktrees, removeWorktree } from "#git/worktree-cli";

import { setupTestRepo, type TestRepo } from "../support/git.js";

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

  it("adds a worktree on a new branch checked out from a base ref", async () => {
    const wtPath = join(wtRoot, "a");
    await addWorktree(repo.root, { worktreePath: wtPath, branch: "feat-a", baseRef: "main" });

    expect(existsSync(join(wtPath, "README.md"))).toBe(true);
    const entries = await listWorktrees(repo.root);
    expect(entries.some((e) => e.branch === "feat-a")).toBe(true);
  });

  it("removes a worktree and leaves no orphan entry", async () => {
    const wtPath = join(wtRoot, "b");
    await addWorktree(repo.root, { worktreePath: wtPath, branch: "feat-b", baseRef: "main" });
    await removeWorktree(repo.root, wtPath, { force: true });
    await pruneWorktrees(repo.root);

    expect(existsSync(wtPath)).toBe(false);
    expect((await listWorktrees(repo.root)).some((e) => e.branch === "feat-b")).toBe(false);
  });

  it("rejects two worktrees on the same branch", async () => {
    await addWorktree(repo.root, {
      worktreePath: join(wtRoot, "c1"),
      branch: "feat-c",
      baseRef: "main",
    });
    await expect(
      addWorktree(repo.root, {
        worktreePath: join(wtRoot, "c2"),
        branch: "feat-c",
        baseRef: "main",
      }),
    ).rejects.toThrow();
  });

  it("tolerates removing an already-removed worktree", async () => {
    const wtPath = join(wtRoot, "idem");
    await addWorktree(repo.root, { worktreePath: wtPath, branch: "feat-idem", baseRef: "main" });
    await removeWorktree(repo.root, wtPath, { force: true });
    await expect(removeWorktree(repo.root, wtPath, { force: true })).resolves.not.toThrow();
    await pruneWorktrees(repo.root);
    expect((await listWorktrees(repo.root)).some((e) => e.branch === "feat-idem")).toBe(false);
  });
});
