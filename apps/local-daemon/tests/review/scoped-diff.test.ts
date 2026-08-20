import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  getRun,
  recordSessionBoundaryError,
  recordSessionPassEnd,
  recordSessionPassStart,
  type RunRow,
} from "@otomat/db";
import type { RunDiffScopeSelector } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver, type GitWorktreeService } from "#git";
import { createReviewService, DiffScopeNotFoundError, type ReviewService } from "#review";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-scope";
const SESSION_ID = `${RUN_ID}-session`;
const BRANCH = "otomat/run/r-scope";
const TARGET = { kind: "run", id: RUN_ID } as const;
const WORKSPACE: RunDiffScopeSelector = { kind: "workspace" };
const PASS: RunDiffScopeSelector = { kind: "session", session: SESSION_ID };

let fix: DaemonTestDb;
let worktrees: GitWorktreeService;
let review: ReviewService;
let worktreePath = "";

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: worktreePath, encoding: "utf8" }).trim();
}

function run(): RunRow {
  const row = getRun(fix.db, RUN_ID);
  if (!row) throw new Error("seeded run missing");
  return row;
}

/** Capture the pass boundary exactly as the supervisor does around a turn. */
function capture(end: boolean): void {
  const state = worktrees.captureState(RUN_ID);
  if (end) recordSessionPassEnd(fix.db, SESSION_ID, state);
  else recordSessionPassStart(fix.db, SESSION_ID, state);
}

beforeEach(() => {
  fix = setupDaemonDb();
  const repositories = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
  const binding = repositories.forRepository("repo-1");
  if (!binding) throw new Error("repo-1 binding missing");
  worktrees = binding.service;
  review = createReviewService({
    db: fix.db,
    dataDir: fix.dataDir,
    repositories,
    appendRunStep: async () => run(),
    publishReviewComment: async () => ({ url: "https://example.invalid/1" }),
    syncViewedFile: async () => "octocat",
    readViewedFiles: async () => ({ viewerLogin: "octocat", files: [] }),
  });

  const acquired = worktrees.acquire({ owner: RUN_ID, branch: BRANCH });
  worktreePath = acquired.path;
  seedRun(fix.db, {
    runId: RUN_ID,
    repositoryId: "repo-1",
    worktreeId: acquired.id,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
});

afterEach(() => {
  fix.cleanup();
});

it("reconstructs a pass that produced only uncommitted changes", () => {
  capture(false);
  writeFileSync(join(worktreePath, "notes.md"), "alpha\n");
  capture(true);

  const result = review.getDiff(TARGET, PASS);

  expect(result.unavailable).toBeNull();
  expect(result.diff?.files.map((file) => file.path)).toEqual(["notes.md"]);
  expect(result.scope).toMatchObject({ kind: "session", agent_session_id: SESSION_ID });
});

it("keeps a pass delta stable after a later pass changes the same file", () => {
  capture(false);
  writeFileSync(join(worktreePath, "notes.md"), "alpha\n");
  capture(true);
  const before = review.getDiff(TARGET, PASS).diff;

  writeFileSync(join(worktreePath, "notes.md"), "alpha\nbeta\ngamma\n");
  writeFileSync(join(worktreePath, "other.md"), "later work\n");

  const after = review.getDiff(TARGET, PASS).diff;
  expect(after?.sha).toBe(before?.sha);
  expect(after?.files.map((file) => file.path)).toEqual(["notes.md"]);
  // The workspace has moved on; the pass has not.
  expect(review.getDiff(TARGET, WORKSPACE).diff?.files.map((f) => f.path)).toEqual([
    "notes.md",
    "other.md",
  ]);
});

it("includes a pass's commits as well as the work it left uncommitted", () => {
  capture(false);
  writeFileSync(join(worktreePath, "committed.md"), "in a commit\n");
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "step work");
  writeFileSync(join(worktreePath, "dirty.md"), "not committed\n");
  capture(true);

  const files = review.getDiff(TARGET, PASS).diff?.files.map((file) => file.path);
  expect(files).toEqual(["committed.md", "dirty.md"]);
});

it("reports a pass with no end boundary rather than showing the workspace diff", () => {
  capture(false);
  writeFileSync(join(worktreePath, "notes.md"), "alpha\n");

  const result = review.getDiff(TARGET, PASS);

  expect(result.diff).toBeNull();
  expect(result.unavailable).toContain("not finished");
});

it("keeps a boundary failure verbatim instead of inventing a delta", () => {
  recordSessionBoundaryError(fix.db, SESSION_ID, "the worktree vanished mid-turn");

  const result = review.getDiff(TARGET, PASS);

  expect(result.diff).toBeNull();
  expect(result.unavailable).toBe("the worktree vanished mid-turn");
});

it("says so when git no longer holds a captured boundary tree", () => {
  capture(false);
  writeFileSync(join(worktreePath, "notes.md"), "alpha\n");
  capture(true);
  recordSessionPassEnd(fix.db, SESSION_ID, {
    treeSha: "0".repeat(40),
    headSha: "0".repeat(40),
  });

  const result = review.getDiff(TARGET, PASS);

  expect(result.diff).toBeNull();
  expect(result.unavailable).toContain("no longer holds");
});

it("diffs a chosen commit against its parent, not against the branch fork point", () => {
  writeFileSync(join(worktreePath, "first.md"), "one\n");
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "first");
  writeFileSync(join(worktreePath, "second.md"), "two\n");
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "second");
  const second = git("rev-parse", "HEAD");

  const result = review.getDiff(TARGET, { kind: "commit", commit: second });

  expect(result.diff?.files.map((file) => file.path)).toEqual(["second.md"]);
  expect(result.scope).toMatchObject({ kind: "commit", subject: "second" });
  // The whole branch carries both; the commit scope must not be confused with it.
  expect(review.getDiff(TARGET, WORKSPACE).diff?.files.map((f) => f.path)).toEqual([
    "first.md",
    "second.md",
  ]);
});

it("lists the branch commits with the identity a picker needs", () => {
  writeFileSync(join(worktreePath, "first.md"), "one\n");
  git("add", "-A");
  git("-c", "user.email=picker@t", "-c", "user.name=Picker", "commit", "-m", "first");

  const listed = review.getBranchCommits(RUN_ID);

  expect(listed.unavailable).toBeNull();
  expect(listed.commits).toHaveLength(1);
  expect(listed.commits[0]).toMatchObject({ subject: "first", author_name: "Picker" });
  expect(listed.commits[0]?.short_sha).toHaveLength(7);
});

it("refuses an unknown commit and an unknown pass rather than answering with another scope", () => {
  expect(() => review.getDiff(TARGET, { kind: "commit", commit: "f".repeat(40) })).toThrow(
    DiffScopeNotFoundError,
  );
  expect(() => review.getDiff(TARGET, { kind: "session", session: "nope" })).toThrow(
    DiffScopeNotFoundError,
  );
});

it("expands context against the trees the scope was taken between", () => {
  writeFileSync(join(worktreePath, "notes.md"), "alpha\n");
  capture(false);
  writeFileSync(join(worktreePath, "notes.md"), "alpha\nbeta\n");
  capture(true);
  // The workspace moves on after the pass; expansion must not follow it.
  writeFileSync(join(worktreePath, "notes.md"), "alpha\nbeta\ngamma\n");

  const file = review.getDiff(TARGET, PASS).diff?.files.find((f) => f.path === "notes.md");
  if (!file) throw new Error("expected notes.md in the pass delta");
  const blobs = review.getFileBlobs(TARGET, { path: "notes.md", sha: file.sha, scope: PASS });

  expect(blobs.base).toBe("alpha\n");
  expect(blobs.head).toBe("alpha\nbeta\n");
});

it("reports a run without a repository instead of throwing", () => {
  seedRun(fix.db, {
    runId: "r-bare",
    repositoryId: null,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  const bare = getRun(fix.db, "r-bare");
  if (!bare) throw new Error("bare run missing");

  const result = review.getDiff({ kind: "run", id: bare.id }, WORKSPACE);

  expect(result.diff).toBeNull();
  expect(result.unavailable).toContain("no git repository");
  expect(review.getBranchCommits("r-bare").unavailable).toContain("no git repository");
});

it("reports a removed worktree rather than reporting an empty branch", () => {
  writeFileSync(join(worktreePath, "notes.md"), "alpha\n");
  capture(false);
  unlinkSync(join(worktreePath, "notes.md"));
  worktrees.cleanup(RUN_ID);

  expect(review.getBranchCommits(RUN_ID).unavailable).toContain("worktree is gone");
});
