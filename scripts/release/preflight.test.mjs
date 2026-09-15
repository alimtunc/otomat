import assert from "node:assert/strict";
import { test } from "node:test";

import { missingToolProblems, preflightProblems, tagProblems } from "./preflight.mjs";

const READY = { ghAuthenticated: true, branch: "main", dirtyEntries: [], ahead: 0, behind: 0 };

const messages = (problems) => problems.map((problem) => problem.message);

test("a clean, synced main passes", () => {
  assert.deepEqual(preflightProblems(READY), []);
});

test("a missing tool is reported with its install command", () => {
  assert.deepEqual(missingToolProblems(["gum", "gh"]), [
    { message: "gum is not installed.", hint: "brew install gum" },
    { message: "gh is not installed.", hint: "brew install gh" },
  ]);
});

test("every local refusal is reported at once", () => {
  const problems = preflightProblems({
    ...READY,
    ghAuthenticated: false,
    branch: "feat/thing",
    dirtyEntries: [" M package.json", "?? notes.md"],
    behind: 2,
  });
  assert.deepEqual(messages(problems), [
    "gh is not authenticated.",
    "A release is cut from main; this checkout is on feat/thing.",
    "The worktree has 2 uncommitted change(s).",
    "main is 2 commit(s) behind origin/main.",
  ]);
  assert.ok(problems.every((problem) => problem.hint.length > 0));
});

test("a detached HEAD is named as such", () => {
  assert.match(messages(preflightProblems({ ...READY, branch: "" }))[0], /detached HEAD/);
});

test("an unpushed or diverged main gets the hint that actually applies", () => {
  const [ahead] = preflightProblems({ ...READY, ahead: 1 });
  assert.match(ahead.message, /1 commit\(s\) ahead/);
  assert.match(ahead.hint, /^git push origin main/);
  const [diverged] = preflightProblems({ ...READY, ahead: 1, behind: 2 });
  assert.equal(diverged.message, "main has diverged from origin/main (1 ahead, 2 behind).");
  assert.match(diverged.hint, /^git rebase origin\/main/);
});

test("an existing tag is refused wherever it lives, deletable only when local-only", () => {
  const absent = { localTags: ["v0.0.1"], remoteTags: ["v0.0.1"], releaseExists: false };
  assert.deepEqual(tagProblems("v0.1.0", absent), []);
  const localOnly = { localTags: ["v0.1.0"], remoteTags: [], releaseExists: false };
  assert.deepEqual(tagProblems("v0.1.0", localOnly), [
    { message: "Tag v0.1.0 already exists locally.", hint: "git tag -d v0.1.0" },
  ]);
  const everywhere = { localTags: ["v0.1.0"], remoteTags: ["v0.1.0"], releaseExists: true };
  assert.deepEqual(messages(tagProblems("v0.1.0", everywhere)), [
    "Tag v0.1.0 already exists on origin.",
    "GitHub release v0.1.0 already exists.",
  ]);
});
