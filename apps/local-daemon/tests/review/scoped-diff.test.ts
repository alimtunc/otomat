import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  getRun,
  insertAgentSession,
  insertPullRequest,
  type NewPullRequest,
  recordSessionBoundaryError,
  recordSessionPassEnd,
  recordSessionPassStart,
  type RunRow,
} from "@otomat/db";
import { BRANCH_DIFF_SCOPE, type RunDiffScopeSelector } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver, type GitWorktreeService } from "#git";
import { createReviewService, DiffScopeNotFoundError, type ReviewService } from "#review";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRun, seedWorkflowRun } from "../support/seed.js";

const RUN_ID = "r-scope";
const SESSION_ID = `${RUN_ID}-session`;
const STEP_ID = `${RUN_ID}-step`;
const BRANCH = "otomat/run/r-scope";
const TARGET = { kind: "run", id: RUN_ID } as const;
const PASS: RunDiffScopeSelector = { kind: "session", session: SESSION_ID };
const STEP: RunDiffScopeSelector = { kind: "step", step: STEP_ID };
const PULL_REQUEST: RunDiffScopeSelector = { kind: "pull_request" };

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
function capture(end: boolean, sessionId = SESSION_ID, runId = RUN_ID): void {
  const state = worktrees.captureState(runId);
  if (end) recordSessionPassEnd(fix.db, sessionId, state);
  else recordSessionPassStart(fix.db, sessionId, state);
}

function addTurn(id: string): string {
  insertAgentSession(fix.db, { id, step_run_id: STEP_ID, status: "terminated" });
  return id;
}

function commit(message: string): string {
  git("add", "-A");
  git("commit", "-m", message);
  return git("rev-parse", "HEAD");
}

const insertRunPullRequest = (
  pr: Pick<NewPullRequest, "id" | "number" | "base_ref" | "published_head_sha">,
): void => {
  insertPullRequest(fix.db, {
    issue_id: "i1",
    run_id: RUN_ID,
    repository_id: "repo-1",
    status: "open",
    publication_status: "created",
    title: "Feature",
    head_ref: BRANCH,
    ...pr,
  });
};

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
    submitPullRequestReview: async () => ({ url: "https://example.invalid/1" }),
    syncViewedFile: async () => "octocat",
    readViewedFiles: async () => ({ viewerLogin: "octocat", files: [] }),
  });

  const acquired = worktrees.acquire({ owner: RUN_ID, branch: BRANCH });
  worktreePath = acquired.path;
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
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
  // The branch has moved on; the pass has not.
  expect(review.getDiff(TARGET, BRANCH_DIFF_SCOPE).diff?.files.map((f) => f.path)).toEqual([
    "notes.md",
    "other.md",
  ]);
});

it("includes a pass's commits as well as the work it left uncommitted", () => {
  capture(false);
  writeFileSync(join(worktreePath, "committed.md"), "in a commit\n");
  commit("step work");
  writeFileSync(join(worktreePath, "dirty.md"), "not committed\n");
  capture(true);

  const files = review.getDiff(TARGET, PASS).diff?.files.map((file) => file.path);
  expect(files).toEqual(["committed.md", "dirty.md"]);
});

it("reports a pass with no end boundary rather than showing the branch diff", () => {
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
  const first = commit("first");
  writeFileSync(join(worktreePath, "second.md"), "two\n");
  const second = commit("second");

  expect(
    review.getDiff(TARGET, { kind: "commit", commit: first }).diff?.files.map((f) => f.path),
  ).toEqual(["first.md"]);
  const result = review.getDiff(TARGET, { kind: "commit", commit: second });

  expect(result.diff?.files.map((file) => file.path)).toEqual(["second.md"]);
  expect(result.scope).toMatchObject({ kind: "commit", subject: "second" });
  // The whole branch carries both; the commit scope must not be confused with it.
  expect(review.getDiff(TARGET, BRANCH_DIFF_SCOPE).diff?.files.map((f) => f.path)).toEqual([
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
  // The branch moves on after the pass; expansion must not follow it.
  writeFileSync(join(worktreePath, "notes.md"), "alpha\nbeta\ngamma\n");

  const file = review.getDiff(TARGET, PASS).diff?.files.find((f) => f.path === "notes.md");
  if (!file) throw new Error("expected notes.md in the pass delta");
  const blobs = review.getFileBlobs(TARGET, { path: "notes.md", sha: file.sha, scope: PASS });

  expect(blobs.base).toEqual({ kind: "text", content: "alpha\n" });
  expect(blobs.head).toEqual({ kind: "text", content: "alpha\nbeta\n" });
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

  const result = review.getDiff({ kind: "run", id: bare.id }, BRANCH_DIFF_SCOPE);

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

it("spans every turn of a step, from the snapshot it entered on to the one it left", () => {
  capture(false);
  writeFileSync(join(worktreePath, "first-turn.md"), "one\n");
  capture(true);
  const resumed = addTurn(`${STEP_ID}-turn-2`);
  capture(false, resumed);
  writeFileSync(join(worktreePath, "second-turn.md"), "two\n");
  capture(true, resumed);

  const result = review.getDiff(TARGET, STEP);

  expect(result.unavailable).toBeNull();
  expect(result.diff?.files.map((file) => file.path)).toEqual(["first-turn.md", "second-turn.md"]);
  expect(result.scope).toMatchObject({
    kind: "step",
    step_run_id: STEP_ID,
    step_name: "Agent turn",
    step_number: 1,
  });
  expect(review.getDiff(TARGET, PASS).diff?.files.map((f) => f.path)).toEqual(["first-turn.md"]);
});

it("reports a step whose last turn has not left a snapshot instead of showing the branch diff", () => {
  capture(false);
  writeFileSync(join(worktreePath, "done.md"), "one\n");
  capture(true);
  const resumed = addTurn(`${STEP_ID}-turn-2`);
  capture(false, resumed);
  writeFileSync(join(worktreePath, "in-flight.md"), "two\n");

  const result = review.getDiff(TARGET, STEP);

  expect(result.diff).toBeNull();
  expect(result.unavailable).toContain("not finished");
  expect(result.scope).toMatchObject({ kind: "step", step_run_id: STEP_ID });
});

it("gives each successive step of a run only its own changes", () => {
  const runId = "r-steps";
  const acquired = worktrees.acquire({ owner: runId, branch: `otomat/run/${runId}` });
  seedWorkflowRun(fix.db, {
    runId,
    repositoryId: "repo-1",
    worktreeId: acquired.id,
    runStatus: "review_ready",
    steps: [
      { id: "s-plan", name: "Plan", status: "succeeded", session: { status: "terminated" } },
      { id: "s-fix", name: "Fix", status: "succeeded", session: { status: "terminated" } },
    ],
  });
  capture(false, "s-plan-session", runId);
  writeFileSync(join(acquired.path, "plan.md"), "planned\n");
  capture(true, "s-plan-session", runId);
  capture(false, "s-fix-session", runId);
  writeFileSync(join(acquired.path, "fix.md"), "fixed\n");
  capture(true, "s-fix-session", runId);

  const target = { kind: "run", id: runId } as const;
  const plan = review.getDiff(target, { kind: "step", step: "s-plan" });
  const fixStep = review.getDiff(target, { kind: "step", step: "s-fix" });

  expect(plan.diff?.files.map((file) => file.path)).toEqual(["plan.md"]);
  expect(plan.scope).toMatchObject({ step_name: "Plan", step_number: 1 });
  expect(fixStep.diff?.files.map((file) => file.path)).toEqual(["fix.md"]);
  expect(fixStep.scope).toMatchObject({ step_name: "Fix", step_number: 2 });
  expect(review.getDiff(target, BRANCH_DIFF_SCOPE).diff?.files.map((f) => f.path)).toEqual([
    "fix.md",
    "plan.md",
  ]);
});

it("lists a path changed more than once exactly once in every scope that carries it", () => {
  capture(false);
  writeFileSync(join(worktreePath, "shared.md"), "one\n");
  capture(true);
  const resumed = addTurn(`${STEP_ID}-turn-2`);
  capture(false, resumed);
  writeFileSync(join(worktreePath, "shared.md"), "one\ntwo\n");
  capture(true, resumed);

  const step = review.getDiff(TARGET, STEP).diff;
  const later = review.getDiff(TARGET, { kind: "session", session: resumed }).diff;
  const branchDiff = review.getDiff(TARGET, BRANCH_DIFF_SCOPE).diff;

  for (const diff of [step, later, branchDiff]) {
    expect(diff?.files.map((file) => file.path)).toEqual(["shared.md"]);
  }
});

it("keeps the branch diff to the branch's own work after a rebase moves its fork point", () => {
  writeFileSync(join(worktreePath, "feature.md"), "branch work\n");
  commit("feature");
  fix.repo.write("base-move.md", "moved on\n");
  fix.repo.commitAll("base branch moves on");
  git("rebase", "main");

  const branchDiff = review.getDiff(TARGET, BRANCH_DIFF_SCOPE);

  expect(branchDiff.diff?.files.map((file) => file.path)).toEqual(["feature.md"]);
  expect(review.getBranchCommits(RUN_ID).commits.map((c) => c.subject)).toEqual(["feature"]);
});

it("still shows a merged cycle's own work once its base branch contains it", () => {
  writeFileSync(join(worktreePath, "feature.md"), "branch work\n");
  commit("feature");
  fix.repo.git("merge", "--no-ff", "-m", "merge", BRANCH);

  const branchDiff = review.getDiff(TARGET, BRANCH_DIFF_SCOPE);

  expect(branchDiff.diff?.files.map((file) => file.path)).toEqual(["feature.md"]);
  expect(review.getBranchCommits(RUN_ID).commits.map((c) => c.subject)).toEqual(["feature"]);
});

it("shows the published head against the branch it targets, not everything the branch holds", () => {
  writeFileSync(join(worktreePath, "feature.md"), "branch work\n");
  commit("feature");
  fix.repo.write("base-move.md", "moved on\n");
  fix.repo.commitAll("base branch moves on");
  git("rebase", "main");
  const published = git("rev-parse", "HEAD");
  insertRunPullRequest({
    id: "pr-scope",
    number: 79,
    base_ref: "main",
    published_head_sha: published,
  });

  const result = review.getDiff(TARGET, PULL_REQUEST);

  expect(result.unavailable).toBeNull();
  expect(result.diff?.files.map((file) => file.path)).toEqual(["feature.md"]);
  expect(result.scope).toEqual({ kind: "pull_request", number: 79 });
});

it("names an unpublished pull request as such rather than answering with its branch diff", () => {
  writeFileSync(join(worktreePath, "notes.md"), "alpha\n");
  insertRunPullRequest({ id: "pr-unpublished", number: 80, base_ref: "main" });

  const result = review.getDiff(TARGET, PULL_REQUEST);

  expect(result.diff).toBeNull();
  expect(result.unavailable).toContain("No head commit is recorded");
  expect(result.scope).toEqual({ kind: "pull_request", number: 80 });
});

it("states that a run has no pull request rather than answering with its branch diff", () => {
  writeFileSync(join(worktreePath, "notes.md"), "alpha\n");

  const result = review.getDiff(TARGET, PULL_REQUEST);

  expect(result.diff).toBeNull();
  expect(result.unavailable).toContain("no pull request");
  expect(result.scope).toEqual({ kind: "pull_request", number: null });
});

it("names the branch and the base ref its diff spans, and pins a head that holds uncommitted work", () => {
  writeFileSync(join(worktreePath, "feature.md"), "branch work\n");

  const result = review.getDiff(TARGET, BRANCH_DIFF_SCOPE);
  commit("feature");

  expect(result.scope).toEqual({ kind: "branch", branch: BRANCH, base_ref: "main" });
  expect(result.diff?.base).toBe(fix.repo.git("rev-parse", "main").trim());
  expect(result.diff?.head).toBe(git("rev-parse", "HEAD^{tree}"));
});

it("measures the branch against the branch its pull request targets, not against its fork base", () => {
  fix.repo.git("branch", "release", "main");
  fix.repo.write("after-release.md", "only on main\n");
  fix.repo.commitAll("main moves past release");
  git("rebase", "main");
  writeFileSync(join(worktreePath, "feature.md"), "branch work\n");
  commit("feature");

  const againstFork = review.getDiff(TARGET, BRANCH_DIFF_SCOPE);
  insertRunPullRequest({ id: "pr-retargeted", number: 81, base_ref: "release" });
  const againstTarget = review.getDiff(TARGET, BRANCH_DIFF_SCOPE);

  expect(againstFork.scope).toMatchObject({ base_ref: "main" });
  expect(againstFork.diff?.files.map((file) => file.path)).toEqual(["feature.md"]);
  expect(againstTarget.scope).toMatchObject({ base_ref: "release" });
  expect(againstTarget.diff?.base).toBe(fix.repo.git("rev-parse", "release").trim());
  expect(againstTarget.diff?.files.map((file) => file.path)).toEqual([
    "after-release.md",
    "feature.md",
  ]);
});

it("counts a scope's own files and lines, never another scope's", () => {
  capture(false);
  writeFileSync(join(worktreePath, "first.md"), "one\n");
  commit("first");
  capture(true);
  writeFileSync(join(worktreePath, "second.md"), "two\nthree\n");
  const only = commit("second");

  const branchDiff = review.getDiff(TARGET, BRANCH_DIFF_SCOPE).diff;
  const step = review.getDiff(TARGET, STEP).diff;
  const one = review.getDiff(TARGET, { kind: "commit", commit: only }).diff;

  expect([branchDiff?.files.length, branchDiff?.additions]).toEqual([2, 3]);
  expect([step?.files.length, step?.additions]).toEqual([1, 1]);
  expect([one?.files.length, one?.additions]).toEqual([1, 2]);
});

it("answers a step that left the tree it entered on with an empty diff, not with a refusal", () => {
  capture(false);
  capture(true);

  const result = review.getDiff(TARGET, STEP);

  expect(result.unavailable).toBeNull();
  expect(result.diff?.files).toEqual([]);
  expect(result.diff?.additions).toBe(0);
});

it("answers a commit that changed nothing with an empty diff, not with a refusal", () => {
  git("commit", "--allow-empty", "-m", "empty");

  const result = review.getDiff(TARGET, { kind: "commit", commit: git("rev-parse", "HEAD") });

  expect(result.unavailable).toBeNull();
  expect(result.diff?.files).toEqual([]);
  expect(result.scope).toMatchObject({ kind: "commit", subject: "empty" });
});

it("refuses a step of another run rather than answering with this one's", () => {
  seedWorkflowRun(fix.db, {
    runId: "r-other",
    repositoryId: "repo-1",
    runStatus: "review_ready",
    steps: [{ id: "s-other", name: "Plan", status: "succeeded" }],
  });

  expect(() => review.getDiff(TARGET, { kind: "step", step: "s-other" })).toThrow(
    DiffScopeNotFoundError,
  );
  expect(() => review.getDiff(TARGET, { kind: "step", step: "nope" })).toThrow(
    DiffScopeNotFoundError,
  );
});
