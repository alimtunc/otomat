import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { branchExists } from "#git/branches";
import { GitCommandError, WorktreeConflictError, WorktreeNotFoundError } from "#git/errors";
import { createGitWorktreeService } from "#git/service";
import { type GitWorktreeService } from "#git/service-contract";
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

  it("acquires a worktree with a dedicated branch and an active row", async () => {
    const wt = await env.service.acquire({ owner: "step-1", branch: "alimtunc/oto-8" });
    expect(wt.status).toBe("active");
    expect(existsSync(join(wt.path, "README.md"))).toBe(true);
    expect(env.service.get("step-1")?.id).toBe(wt.id);
  });

  it("creates two parallel worktrees on the same repo without collision", async () => {
    const a = await env.service.acquire({ owner: "owner-a", branch: "feat-a" });
    const b = await env.service.acquire({ owner: "owner-b", branch: "feat-b" });

    expect(a.path).not.toBe(b.path);
    writeFileSync(join(a.path, "a.txt"), "AAA\n");
    writeFileSync(join(b.path, "b.txt"), "BBB\nBBB\n");

    const diffA = await env.service.diff("owner-a");
    const diffB = await env.service.diff("owner-b");
    expect(diffA.files.map((f) => f.path)).toContain("a.txt");
    expect(diffA.files.map((f) => f.path)).not.toContain("b.txt");
    expect(diffB.files.map((f) => f.path)).toContain("b.txt");
    expect(diffA.sha).not.toBe(diffB.sha);
  });

  it("is idempotent for the same owner and branch", async () => {
    const w1 = await env.service.acquire({ owner: "step-1", branch: "feat-s" });
    const w2 = await env.service.acquire({ owner: "step-1", branch: "feat-s" });
    expect(w2.id).toBe(w1.id);
    expect(env.service.list({ status: "active" }).filter((r) => r.owner === "step-1")).toHaveLength(
      1,
    );
  });

  it("rejects a second active worktree for the same owner on a different branch", async () => {
    await env.service.acquire({ owner: "step-1", branch: "feat-s" });
    await expect(env.service.acquire({ owner: "step-1", branch: "feat-other" })).rejects.toThrow(
      WorktreeConflictError,
    );
  });

  it("rejects reusing a branch already held by another active worktree", async () => {
    await env.service.acquire({ owner: "owner-a", branch: "shared" });
    await expect(env.service.acquire({ owner: "owner-b", branch: "shared" })).rejects.toThrow(
      WorktreeConflictError,
    );
  });

  it("refuses a concurrent acquire of the same branch without disturbing the one that won", async () => {
    const outcomes = await Promise.allSettled([
      env.service.acquire({ owner: "owner-a", branch: "raced" }),
      env.service.acquire({ owner: "owner-b", branch: "raced" }),
    ]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(["fulfilled", "rejected"]);
    expect(outcomes[1]).toMatchObject({ reason: expect.any(WorktreeConflictError) });
    const winner = env.service.get("owner-a");
    expect(winner && existsSync(winner.path)).toBe(true);
    expect(await branchExists(env.repo.root, "raced")).toBe(true);
  });

  it("records the ref it forked from so callers never re-derive the base branch", async () => {
    env.repo.git("branch", "release/v1");
    const wt = await env.service.acquire({
      owner: "step-1",
      branch: "feat-r",
      baseRef: "release/v1",
    });

    expect(wt.baseRef).toBe("release/v1");
    expect(env.service.get("step-1")?.baseRef).toBe("release/v1");
    expect((await env.service.acquire({ owner: "step-2", branch: "feat-d" })).baseRef).toBe("main");
  });

  it("leaves no branch behind when git cannot check the working directory out", async () => {
    const wt = await env.service.acquire({ owner: "step-1", branch: "feat-doomed" });
    await env.service.cleanup("step-1");
    // A crash can leave the working directory behind; `git worktree add` then refuses,
    // but only after `-b` has already created the branch in the user's repository.
    mkdirSync(wt.path, { recursive: true });
    writeFileSync(join(wt.path, "leftover.txt"), "from a previous crash\n");

    await expect(env.service.acquire({ owner: "step-1", branch: "feat-doomed" })).rejects.toThrow(
      GitCommandError,
    );
    expect(await branchExists(env.repo.root, "feat-doomed")).toBe(false);
    expect(env.service.get("step-1")).toBeUndefined();
    expect(await listWorktrees(env.repo.root)).toHaveLength(1);
  });

  it("lists changed files and computes a stable canonical diff from git", async () => {
    const wt = await env.service.acquire({ owner: "step-1", branch: "feat-d" });
    writeFileSync(join(wt.path, "README.md"), "changed\n");
    writeFileSync(join(wt.path, "new.txt"), "hello\n");

    const files = await env.service.changedFiles("step-1");
    expect(files.some((f) => f.path === "README.md" && f.status === "modified")).toBe(true);
    expect(files.some((f) => f.path === "new.txt" && f.status === "added")).toBe(true);

    const d1 = await env.service.diff("step-1");
    const d2 = await env.service.diff("step-1");
    expect(d1.sha).toBe(d2.sha);
    expect(d1.additions).toBeGreaterThan(0);
  });

  it("serves snapshot blobs from the captured tree even after the worktree moves on", async () => {
    const wt = await env.service.acquire({ owner: "snap", branch: "feat-snap" });
    writeFileSync(join(wt.path, "file.txt"), "captured\n");
    const { snapshot } = await env.service.branchDiff("snap");
    writeFileSync(join(wt.path, "file.txt"), "mutated\n");

    const file = snapshot.diff.files.find((f) => f.path === "file.txt");
    expect(file).toBeDefined();
    expect((await snapshot.fileBlobs({ path: "file.txt", oldPath: null })).head).toBe("captured\n");
    expect((await env.service.diff("snap")).files.find((f) => f.path === "file.txt")?.sha).not.toBe(
      file?.sha,
    );
  });

  it("diffs a commit against the fork point, leaving uncommitted work out of it", async () => {
    const wt = await env.service.acquire({ owner: "committed", branch: "feat-commit" });
    writeFileSync(join(wt.path, "file.txt"), "committed\n");
    const commit = (await env.service.snapshot("committed")).headSha;
    writeFileSync(join(wt.path, "file.txt"), "committed\nuncommitted\n");

    const atCommit = await env.service.commitDiff("committed", commit);

    expect(atCommit.files.find((f) => f.path === "file.txt")?.patch).not.toContain("uncommitted");
    expect(
      (await env.service.diff("committed")).files.find((f) => f.path === "file.txt")?.patch,
    ).toContain("uncommitted");
    expect(atCommit.sha).not.toBe((await env.service.diff("committed")).sha);
  });

  it("snapshots dirty work without removing the active worktree", async () => {
    const wt = await env.service.acquire({ owner: "publisher", branch: "feat-publish" });
    writeFileSync(join(wt.path, "published.txt"), "ready\n");
    const diffBefore = await env.service.diff("publisher");

    const snapshot = await env.service.snapshot("publisher");

    expect(snapshot.status).toBe("active");
    expect(snapshot.path).toBe(wt.path);
    expect(existsSync(wt.path)).toBe(true);
    expect(snapshot.headSha).toBe(env.repo.git("-C", wt.path, "rev-parse", "HEAD").trim());
    expect(snapshot.headSha).not.toBe(wt.headSha);
    expect(env.repo.git("-C", wt.path, "status", "--porcelain").trim()).toBe("");
    expect((await env.service.diff("publisher")).sha).toBe(diffBefore.sha);
    expect(env.service.get("publisher")?.headSha).toBe(snapshot.headSha);

    expect((await env.service.snapshot("publisher")).headSha).toBe(snapshot.headSha);
  });

  it("archives a worktree: removes the dir, keeps the branch, leaves no orphan, diff survives", async () => {
    const wt = await env.service.acquire({ owner: "loser", branch: "feat-l" });
    writeFileSync(join(wt.path, "work.txt"), "loser work\n");

    const archived = await env.service.archive("loser");
    expect(archived.status).toBe("archived");
    expect(existsSync(wt.path)).toBe(false);
    expect(await branchExists(env.repo.root, "feat-l")).toBe(true);
    expect((await listWorktrees(env.repo.root)).some((e) => e.branch === "feat-l")).toBe(false);

    const diff = await env.service.diff("loser");
    expect(diff.files.some((f) => f.path === "work.txt")).toBe(true);
  });

  it("cleans up a worktree: removes dir and branch, leaves no orphan", async () => {
    const wt = await env.service.acquire({ owner: "step-1", branch: "feat-x" });
    await env.service.cleanup("step-1");

    expect(existsSync(wt.path)).toBe(false);
    expect(await branchExists(env.repo.root, "feat-x")).toBe(false);
    expect((await listWorktrees(env.repo.root)).some((e) => e.branch === "feat-x")).toBe(false);
    expect(env.service.get("step-1")).toBeUndefined();
  });

  it("archive converges when the worktree directory has vanished (crash recovery)", async () => {
    const wt = await env.service.acquire({ owner: "crashed", branch: "feat-crash" });
    rmSync(wt.path, { recursive: true, force: true });

    const archived = await env.service.archive("crashed");
    expect(archived.status).toBe("archived");
    expect(env.service.get("crashed")).toBeUndefined();
    expect(await branchExists(env.repo.root, "feat-crash")).toBe(true);
    expect((await listWorktrees(env.repo.root)).some((e) => e.branch === "feat-crash")).toBe(false);
  });

  it("includes committed work, anchored to the fork point, in the canonical diff", async () => {
    const wt = await env.service.acquire({ owner: "committer", branch: "feat-commit" });
    writeFileSync(join(wt.path, "committed.txt"), "done\n");
    env.repo.git("-C", wt.path, "add", "-A");
    env.repo.git("-C", wt.path, "commit", "-m", "work");
    writeFileSync(join(wt.path, "uncommitted.txt"), "wip\n");

    const diff = await env.service.diff("committer");
    const paths = diff.files.map((f) => f.path);
    expect(paths).toContain("committed.txt");
    expect(paths).toContain("uncommitted.txt");
    expect(diff.base).toBe(env.repo.git("rev-parse", "main").trim());
  });

  it("supports the compete lifecycle: archive the loser, then clean it up", async () => {
    await env.service.acquire({ owner: "winner", branch: "feat-win" });
    await env.service.acquire({ owner: "loser", branch: "feat-lose" });
    await env.service.archive("loser");
    await env.service.cleanup("loser");

    expect(await branchExists(env.repo.root, "feat-lose")).toBe(false);
    expect(env.service.list().some((r) => r.owner === "loser" && r.status !== "removed")).toBe(
      false,
    );
    expect(env.service.get("winner")?.status).toBe("active");
  });

  it("fast-forwards the canonical worktree to exactly one candidate result", async () => {
    const canonical = await env.service.acquire({ owner: "run-1", branch: "otomat/run/run-1" });
    writeFileSync(join(canonical.path, "shared.txt"), "shared base\n");
    const base = await env.service.snapshot("run-1");
    const candidate = await env.service.acquire({
      owner: "candidate-a",
      branch: "otomat/run/run-1--compete-candidate-a",
      baseRef: base.branch,
    });
    writeFileSync(join(candidate.path, "winner.txt"), "winner\n");

    const promoted = await env.service.promote("candidate-a", "run-1", base.headSha);

    expect(readFileSync(join(canonical.path, "winner.txt"), "utf8")).toBe("winner\n");
    expect(promoted.canonical.headSha).toBe(promoted.source.headSha);
    expect(
      env.repo.git("-C", canonical.path, "rev-list", "--count", base.headSha + "..HEAD").trim(),
    ).toBe("1");
  });

  it("replays the same promotion idempotently", async () => {
    await env.service.acquire({ owner: "run-1", branch: "otomat/run/run-1" });
    const base = await env.service.snapshot("run-1");
    const candidate = await env.service.acquire({
      owner: "candidate-a",
      branch: "otomat/run/run-1--compete-candidate-a",
      baseRef: base.branch,
    });
    writeFileSync(join(candidate.path, "winner.txt"), "winner\n");

    const first = await env.service.promote("candidate-a", "run-1", base.headSha);
    const second = await env.service.promote("candidate-a", "run-1", base.headSha);

    expect(second.canonical.headSha).toBe(first.canonical.headSha);
    expect(second.source.headSha).toBe(first.source.headSha);
  });

  it("rejects promotion when the canonical worktree changed after competitors forked", async () => {
    const canonical = await env.service.acquire({ owner: "run-1", branch: "otomat/run/run-1" });
    const base = await env.service.snapshot("run-1");
    const candidate = await env.service.acquire({
      owner: "candidate-a",
      branch: "otomat/run/run-1--compete-candidate-a",
      baseRef: base.branch,
    });
    writeFileSync(join(candidate.path, "winner.txt"), "winner\n");
    writeFileSync(join(canonical.path, "diverged.txt"), "canonical change\n");
    await env.service.snapshot("run-1");

    await expect(env.service.promote("candidate-a", "run-1", base.headSha)).rejects.toThrow(
      WorktreeConflictError,
    );
  });

  it("re-acquires an owner after cleanup with a fresh active worktree", async () => {
    const first = await env.service.acquire({ owner: "reuse", branch: "feat-r1" });
    await env.service.cleanup("reuse");
    const second = await env.service.acquire({ owner: "reuse", branch: "feat-r2" });

    expect(second.id).not.toBe(first.id);
    expect(env.service.get("reuse")?.branch).toBe("feat-r2");
  });

  it("filters list() by status", async () => {
    await env.service.acquire({ owner: "a", branch: "fa" });
    await env.service.acquire({ owner: "b", branch: "fb" });
    await env.service.archive("b");

    expect(env.service.list()).toHaveLength(2);
    expect(env.service.list({ status: "active" }).map((r) => r.owner)).toEqual(["a"]);
    expect(env.service.list({ status: "archived" }).map((r) => r.owner)).toEqual(["b"]);
  });

  it("rejects acquiring a branch that already exists in the repository", async () => {
    env.repo.git("branch", "leftover");
    await expect(env.service.acquire({ owner: "x", branch: "leftover" })).rejects.toThrow(
      WorktreeConflictError,
    );
  });

  it("throws WorktreeNotFoundError for an unknown owner", async () => {
    await expect(env.service.diff("ghost")).rejects.toThrow(WorktreeNotFoundError);
    await expect(env.service.snapshot("ghost")).rejects.toThrow(WorktreeNotFoundError);
    await expect(env.service.archive("ghost")).rejects.toThrow(WorktreeNotFoundError);
  });

  describe("worktreeTree", () => {
    const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x01]);
    let worktree: string;

    beforeEach(async () => {
      env.repo.write("src/app.ts", "export const a = 1;\n");
      env.repo.write("assets/pixel.png", PNG_BYTES.toString("latin1"));
      env.repo.write(".gitignore", "ignored.txt\n");
      env.repo.commitAll("seed");
      worktree = (await env.service.acquire({ owner: "files", branch: "feat/files" })).path;
    });

    it("lists the live worktree with untracked files and without ignored ones", async () => {
      writeFileSync(join(worktree, "notes.md"), "draft\n");
      writeFileSync(join(worktree, "ignored.txt"), "secret\n");
      symlinkSync("/etc/hostname", join(worktree, "host-link"));

      const tree = await env.service.worktreeTree("files");
      const byPath = new Map((await tree.entries()).map((entry) => [entry.path, entry]));

      expect(tree.worktreePath).toBe(worktree);
      expect(byPath.get("notes.md")).toMatchObject({ kind: "file", size: 6 });
      expect(byPath.get("host-link")?.kind).toBe("symlink");
      expect(byPath.has("ignored.txt")).toBe(false);
      expect(byPath.has(".git")).toBe(false);
    });

    it("reads text with its blob revision and names binaries and symlinks by kind", async () => {
      symlinkSync("/etc/hostname", join(worktree, "host-link"));
      const tree = await env.service.worktreeTree("files");
      const limits = { maxBytes: 1024 };

      const text = await tree.readFile("src/app.ts", limits);
      expect(text.kind).toBe("text");
      if (text.kind === "text") expect(text.oid).toMatch(/^[0-9a-f]{40}$/);
      expect((await tree.readFile("assets/pixel.png", limits)).kind).toBe("binary");
      expect((await tree.readFile("host-link", limits)).kind).toBe("symlink");
      expect((await tree.readFile("src", limits)).kind).toBe("directory");
      expect((await tree.readFile("src/app.ts", { maxBytes: 4 })).kind).toBe("too_large");
    });

    it("serves the archived branch tip read-only once the worktree is gone", async () => {
      writeFileSync(join(worktree, "src/app.ts"), "export const a = 2;\n");
      await env.service.archive("files");

      const tree = await env.service.worktreeTree("files");
      expect(tree.worktreePath).toBeNull();
      const read = await tree.readFile("src/app.ts", { maxBytes: 1024 });
      expect(read.kind === "text" && read.text).toBe("export const a = 2;\n");
    });
  });
});
