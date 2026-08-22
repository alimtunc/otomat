import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  getReviewComment,
  getRun,
  recordSessionPassEnd,
  recordSessionPassStart,
  type ReviewCommentRow,
  type RunRow,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver, type GitWorktreeService } from "#git";
import { createReviewService, type ReviewService } from "#review";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-proof";
const SESSION_ID = `${RUN_ID}-session`;
const BRANCH = "otomat/run/r-proof";

const BEFORE = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

let fix: DaemonTestDb;
let worktrees: GitWorktreeService;
let review: ReviewService;
let worktreePath = "";

function run(): RunRow {
  const row = getRun(fix.db, RUN_ID);
  if (!row) throw new Error("seeded run missing");
  return row;
}

function write(lines: string[]): void {
  writeFileSync(join(worktreePath, "notes.md"), `${lines.join("\n")}\n`);
}

async function comment(line: number, startLine: number | null = null): Promise<ReviewCommentRow> {
  const diff = review.getDiff({ kind: "run", id: RUN_ID }).diff;
  const file = diff?.files.find((entry) => entry.path === "notes.md");
  if (!file) throw new Error("expected notes.md in the diff");
  return review.addComment(
    { kind: "run", id: RUN_ID },
    {
      file_path: "notes.md",
      side: "new",
      start_line: startLine,
      line,
      diff_sha: file.sha,
      body: "Please rename this.",
      destination: "agent",
    },
  );
}

/** Runs one fix pass end to end: capture the boundary, apply `edit`, settle. */
function fixPass(edit: () => void): void {
  recordSessionPassStart(fix.db, SESSION_ID, worktrees.captureState(RUN_ID));
  edit();
  recordSessionPassEnd(fix.db, SESSION_ID, worktrees.captureState(RUN_ID));
  review.onRunSettled({ runId: RUN_ID, agentSessionId: SESSION_ID, classification: "completed" });
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
  write(BEFORE);
});

afterEach(() => {
  fix.cleanup();
});

it("shows only the hunks the fix pass changed around the comment's lines", async () => {
  const target = await comment(2);
  await review.requestFix(run(), {
    selector: { kind: "runtime", runtimeId: "fake" },
    overrides: {},
    note: null,
    references: [],
  });
  fixPass(() =>
    write(["one", "TWO", "three", "four", "five", "six", "seven", "eight", "nine", "TEN"]),
  );

  expect(getReviewComment(fix.db, target.id)?.status).toBe("addressed");
  expect(getReviewComment(fix.db, target.id)?.fixed_by_session_id).toBe(SESSION_ID);

  const proof = review.getCommentFixProof(RUN_ID, target.id);
  if (proof.state !== "reported") throw new Error(`expected a reported proof, got ${proof.state}`);

  expect(proof.pass.agent_session_id).toBe(SESSION_ID);
  expect(proof.whole_file).toBe(false);
  expect(proof.excerpt).toContain("-two");
  expect(proof.excerpt).toContain("+TWO");
  // The unrelated tail edit belongs to the same pass, but not to this comment.
  expect(proof.excerpt).not.toContain("+TEN");
  // The whole file's delta stays available behind the excerpt for context expansion.
  expect(proof.file.patch).toContain("+TEN");
});

it("gives two comments fixed by one pass their own excerpt and the same full delta", async () => {
  const first = await comment(2);
  const second = await comment(10);
  await review.requestFix(run(), {
    selector: { kind: "runtime", runtimeId: "fake" },
    overrides: {},
    note: null,
    references: [],
  });
  fixPass(() =>
    write(["one", "TWO", "three", "four", "five", "six", "seven", "eight", "nine", "TEN"]),
  );

  const firstProof = review.getCommentFixProof(RUN_ID, first.id);
  const secondProof = review.getCommentFixProof(RUN_ID, second.id);
  if (firstProof.state !== "reported" || secondProof.state !== "reported") {
    throw new Error("expected both comments to report a proof");
  }

  expect(firstProof.excerpt).toContain("+TWO");
  expect(firstProof.excerpt).not.toContain("+TEN");
  expect(secondProof.excerpt).toContain("+TEN");
  expect(secondProof.excerpt).not.toContain("+TWO");
  expect(secondProof.pass.agent_session_id).toBe(firstProof.pass.agent_session_id);
});

it("says nothing relevant was attributed when the pass missed the anchored lines", async () => {
  const target = await comment(2);
  await review.requestFix(run(), {
    selector: { kind: "runtime", runtimeId: "fake" },
    overrides: {},
    note: null,
    references: [],
  });
  fixPass(() =>
    write(["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "TEN"]),
  );

  const proof = review.getCommentFixProof(RUN_ID, target.id);

  expect(proof.state).toBe("no_change");
  if (proof.state !== "no_change") throw new Error("expected no_change");
  expect(proof.reason).toContain("not the lines this comment anchors to");
});

it("says the pass did not touch the file at all rather than showing another one", async () => {
  const target = await comment(2);
  await review.requestFix(run(), {
    selector: { kind: "runtime", runtimeId: "fake" },
    overrides: {},
    note: null,
    references: [],
  });
  fixPass(() => writeFileSync(join(worktreePath, "elsewhere.md"), "unrelated\n"));

  const proof = review.getCommentFixProof(RUN_ID, target.id);

  expect(proof.state).toBe("no_change");
  if (proof.state !== "no_change") throw new Error("expected no_change");
  expect(proof.reason).toContain("did not change notes.md");
});

it("stays exact after a later pass rewrites the same lines", async () => {
  const target = await comment(2);
  await review.requestFix(run(), {
    selector: { kind: "runtime", runtimeId: "fake" },
    overrides: {},
    note: null,
    references: [],
  });
  fixPass(() =>
    write(["one", "TWO", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]),
  );
  const first = review.getCommentFixProof(RUN_ID, target.id);

  write(["one", "SOMETHING ELSE ENTIRELY", "three"]);

  const later = review.getCommentFixProof(RUN_ID, target.id);
  if (first.state !== "reported" || later.state !== "reported") {
    throw new Error("expected the proof to survive the later pass");
  }
  expect(later.excerpt).toBe(first.excerpt);
  expect(later.excerpt).not.toContain("SOMETHING ELSE ENTIRELY");
});

it("reports an unavailable proof for a comment no pass addressed", async () => {
  const target = await comment(2);

  const proof = review.getCommentFixProof(RUN_ID, target.id);

  expect(proof.state).toBe("unavailable");
  if (proof.state !== "unavailable") throw new Error("expected unavailable");
  expect(proof.reason).toContain("No fix pass is recorded");
});

it("falls back to the file's whole delta for a whole-file anchor, and says so", async () => {
  const diff = review.getDiff({ kind: "run", id: RUN_ID }).diff;
  const file = diff?.files.find((entry) => entry.path === "notes.md");
  if (!file) throw new Error("expected notes.md in the diff");
  const target = await review.addComment(
    { kind: "run", id: RUN_ID },
    {
      file_path: "notes.md",
      side: "new",
      start_line: null,
      line: null,
      diff_sha: file.sha,
      body: "This whole file needs work.",
      destination: "agent",
    },
  );
  await review.requestFix(run(), {
    selector: { kind: "runtime", runtimeId: "fake" },
    overrides: {},
    note: null,
    references: [],
  });
  fixPass(() =>
    write(["one", "TWO", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]),
  );

  const proof = review.getCommentFixProof(RUN_ID, target.id);
  if (proof.state !== "reported") throw new Error("expected a reported proof");

  expect(proof.whole_file).toBe(true);
  expect(proof.excerpt).toBe(proof.file.patch);
});
