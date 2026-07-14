import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WorktreeConflictError, WorktreeNotFoundError } from "#git/errors";
import { branchExists } from "#git/repo";
import { createGitWorktreeService, type GitWorktreeService } from "#git/service";
import { listWorktrees } from "#git/worktree-cli";

import { setupGitDb, setupTestRepo, type GitTestDb, type TestRepo } from "../support/git.js";

interface Env {
  repo: TestRepo;
  db: GitTestDb;
  service: GitWorktreeService;
  cleanup(): void;
}

function setup(): Env {
  const repo = setupTestRepo();
  const db = setupGitDb();
  const worktreesRoot = mkdtempSync(join(tmpdir(), "otomat-wt-root-"));
  const service = createGitWorktreeService({
    db: db.client.db,
    repositoryId: db.repositoryId,
    repoRoot: repo.root,
    defaultBranch: "main",
    worktreesRoot,
  });
  return {
    repo,
    db,
    service,
    cleanup() {
      rmSync(worktreesRoot, { recursive: true, force: true });
      db.cleanup();
      repo.cleanup();
    },
  };
}

describe("GitWorktreeService", () => {
  let env: Env;

  beforeEach(() => {
    env = setup();
  });

  afterEach(() => {
    env.cleanup();
  });

  it("acquires a worktree with a dedicated branch and an active row", () => {
    const wt = env.service.acquire({ owner: "step-1", branch: "alimtunc/oto-8" });
    expect(wt.status).toBe("active");
    expect(existsSync(join(wt.path, "README.md"))).toBe(true);
    expect(env.service.get("step-1")?.id).toBe(wt.id);
  });

  it("creates two parallel worktrees on the same repo without collision", () => {
    const a = env.service.acquire({ owner: "owner-a", branch: "feat-a" });
    const b = env.service.acquire({ owner: "owner-b", branch: "feat-b" });

    expect(a.path).not.toBe(b.path);
    writeFileSync(join(a.path, "a.txt"), "AAA\n");
    writeFileSync(join(b.path, "b.txt"), "BBB\nBBB\n");

    const diffA = env.service.diff("owner-a");
    const diffB = env.service.diff("owner-b");
    expect(diffA.files.map((f) => f.path)).toContain("a.txt");
    expect(diffA.files.map((f) => f.path)).not.toContain("b.txt");
    expect(diffB.files.map((f) => f.path)).toContain("b.txt");
    expect(diffA.sha).not.toBe(diffB.sha);
  });

  it("is idempotent for the same owner and branch", () => {
    const w1 = env.service.acquire({ owner: "step-1", branch: "feat-s" });
    const w2 = env.service.acquire({ owner: "step-1", branch: "feat-s" });
    expect(w2.id).toBe(w1.id);
    expect(env.service.list({ status: "active" }).filter((r) => r.owner === "step-1")).toHaveLength(
      1,
    );
  });

  it("rejects a second active worktree for the same owner on a different branch", () => {
    env.service.acquire({ owner: "step-1", branch: "feat-s" });
    expect(() => env.service.acquire({ owner: "step-1", branch: "feat-other" })).toThrow(
      WorktreeConflictError,
    );
  });

  it("rejects reusing a branch already held by another active worktree", () => {
    env.service.acquire({ owner: "owner-a", branch: "shared" });
    expect(() => env.service.acquire({ owner: "owner-b", branch: "shared" })).toThrow(
      WorktreeConflictError,
    );
  });

  it("lists changed files and computes a stable canonical diff from git", () => {
    const wt = env.service.acquire({ owner: "step-1", branch: "feat-d" });
    writeFileSync(join(wt.path, "README.md"), "changed\n");
    writeFileSync(join(wt.path, "new.txt"), "hello\n");

    const files = env.service.changedFiles("step-1");
    expect(files.some((f) => f.path === "README.md" && f.status === "modified")).toBe(true);
    expect(files.some((f) => f.path === "new.txt" && f.status === "added")).toBe(true);

    const d1 = env.service.diff("step-1");
    const d2 = env.service.diff("step-1");
    expect(d1.sha).toBe(d2.sha);
    expect(d1.additions).toBeGreaterThan(0);
  });

  it("snapshots dirty work without removing the active worktree", () => {
    const wt = env.service.acquire({ owner: "publisher", branch: "feat-publish" });
    writeFileSync(join(wt.path, "published.txt"), "ready\n");
    const diffBefore = env.service.diff("publisher");

    const snapshot = env.service.snapshot("publisher");

    expect(snapshot.status).toBe("active");
    expect(snapshot.path).toBe(wt.path);
    expect(existsSync(wt.path)).toBe(true);
    expect(snapshot.headSha).toBe(env.repo.git("-C", wt.path, "rev-parse", "HEAD").trim());
    expect(snapshot.headSha).not.toBe(wt.headSha);
    expect(env.repo.git("-C", wt.path, "status", "--porcelain").trim()).toBe("");
    expect(env.service.diff("publisher").sha).toBe(diffBefore.sha);
    expect(env.service.get("publisher")?.headSha).toBe(snapshot.headSha);

    expect(env.service.snapshot("publisher").headSha).toBe(snapshot.headSha);
  });

  it("archives a worktree: removes the dir, keeps the branch, leaves no orphan, diff survives", () => {
    const wt = env.service.acquire({ owner: "loser", branch: "feat-l" });
    writeFileSync(join(wt.path, "work.txt"), "loser work\n");

    const archived = env.service.archive("loser");
    expect(archived.status).toBe("archived");
    expect(existsSync(wt.path)).toBe(false);
    expect(branchExists(env.repo.root, "feat-l")).toBe(true);
    expect(listWorktrees(env.repo.root).some((e) => e.branch === "feat-l")).toBe(false);

    const diff = env.service.diff("loser");
    expect(diff.files.some((f) => f.path === "work.txt")).toBe(true);
  });

  it("cleans up a worktree: removes dir and branch, leaves no orphan", () => {
    const wt = env.service.acquire({ owner: "step-1", branch: "feat-x" });
    env.service.cleanup("step-1");

    expect(existsSync(wt.path)).toBe(false);
    expect(branchExists(env.repo.root, "feat-x")).toBe(false);
    expect(listWorktrees(env.repo.root).some((e) => e.branch === "feat-x")).toBe(false);
    expect(env.service.get("step-1")).toBeUndefined();
  });

  it("archive converges when the worktree directory has vanished (crash recovery)", () => {
    const wt = env.service.acquire({ owner: "crashed", branch: "feat-crash" });
    rmSync(wt.path, { recursive: true, force: true });

    const archived = env.service.archive("crashed");
    expect(archived.status).toBe("archived");
    expect(env.service.get("crashed")).toBeUndefined();
    expect(branchExists(env.repo.root, "feat-crash")).toBe(true);
    expect(listWorktrees(env.repo.root).some((e) => e.branch === "feat-crash")).toBe(false);
  });

  it("includes committed work, anchored to the fork point, in the canonical diff", () => {
    const wt = env.service.acquire({ owner: "committer", branch: "feat-commit" });
    writeFileSync(join(wt.path, "committed.txt"), "done\n");
    env.repo.git("-C", wt.path, "add", "-A");
    env.repo.git("-C", wt.path, "commit", "-m", "work");
    writeFileSync(join(wt.path, "uncommitted.txt"), "wip\n");

    const diff = env.service.diff("committer");
    const paths = diff.files.map((f) => f.path);
    expect(paths).toContain("committed.txt");
    expect(paths).toContain("uncommitted.txt");
    expect(diff.base).toBe(env.repo.git("rev-parse", "main").trim());
  });

  it("supports the compete lifecycle: archive the loser, then clean it up", () => {
    env.service.acquire({ owner: "winner", branch: "feat-win" });
    env.service.acquire({ owner: "loser", branch: "feat-lose" });
    env.service.archive("loser");
    env.service.cleanup("loser");

    expect(branchExists(env.repo.root, "feat-lose")).toBe(false);
    expect(env.service.list().some((r) => r.owner === "loser" && r.status !== "removed")).toBe(
      false,
    );
    expect(env.service.get("winner")?.status).toBe("active");
  });

  it("re-acquires an owner after cleanup with a fresh active worktree", () => {
    const first = env.service.acquire({ owner: "reuse", branch: "feat-r1" });
    env.service.cleanup("reuse");
    const second = env.service.acquire({ owner: "reuse", branch: "feat-r2" });

    expect(second.id).not.toBe(first.id);
    expect(env.service.get("reuse")?.branch).toBe("feat-r2");
  });

  it("filters list() by status", () => {
    env.service.acquire({ owner: "a", branch: "fa" });
    env.service.acquire({ owner: "b", branch: "fb" });
    env.service.archive("b");

    expect(env.service.list()).toHaveLength(2);
    expect(env.service.list({ status: "active" }).map((r) => r.owner)).toEqual(["a"]);
    expect(env.service.list({ status: "archived" }).map((r) => r.owner)).toEqual(["b"]);
  });

  it("rejects acquiring a branch that already exists in the repository", () => {
    env.repo.git("branch", "leftover");
    expect(() => env.service.acquire({ owner: "x", branch: "leftover" })).toThrow(
      WorktreeConflictError,
    );
  });

  it("throws WorktreeNotFoundError for an unknown owner", () => {
    expect(() => env.service.diff("ghost")).toThrow(WorktreeNotFoundError);
    expect(() => env.service.snapshot("ghost")).toThrow(WorktreeNotFoundError);
    expect(() => env.service.archive("ghost")).toThrow(WorktreeNotFoundError);
  });
});
