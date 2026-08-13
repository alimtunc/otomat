import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CONTEXT_FILE_MAX_BYTES } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readContextFile } from "#context";
import type { TreeSnapshot } from "#git";
import { createGitWorktreeService } from "#git/service";

import { setupGitDb, setupTestRepo, type GitTestDb, type TestRepo } from "../support/git.js";

let repo: TestRepo;
let db: GitTestDb;
let worktreesRoot: string;
let snapshot: TreeSnapshot;

beforeEach(() => {
  repo = setupTestRepo();
  db = setupGitDb();
  worktreesRoot = mkdtempSync(join(tmpdir(), "otomat-wt-root-"));

  const outside = mkdtempSync(join(tmpdir(), "otomat-outside-"));
  writeFileSync(join(outside, "secret.txt"), "TOP-SECRET\n");
  repo.write("src/parser.ts", "export const parse = () => 1;\n");
  repo.write("assets/logo.bin", "PNG\0\0binary\n");
  repo.write("huge.txt", "x".repeat(CONTEXT_FILE_MAX_BYTES + 1));
  symlinkSync(join(outside, "secret.txt"), join(repo.root, "leak"));
  repo.commitAll("fixtures");

  snapshot = createGitWorktreeService({
    db: db.client.db,
    repositoryId: db.repositoryId,
    repoRoot: repo.root,
    defaultBranch: "main",
    worktreesRoot,
  }).treeSnapshot("main");
});

afterEach(() => {
  rmSync(worktreesRoot, { recursive: true, force: true });
  db.cleanup();
  repo.cleanup();
});

it("reads a tracked text file whole, from the captured tree", () => {
  expect(readContextFile(snapshot, "src/parser.ts")).toEqual({
    state: "read",
    path: "src/parser.ts",
    bytes: 30,
    text: "export const parse = () => 1;\n",
  });
});

it("normalizes a picker's leading ./ without changing which file is named", () => {
  expect(readContextFile(snapshot, "./src/parser.ts")).toMatchObject({
    state: "read",
    path: "src/parser.ts",
  });
});

it("refuses a symlink instead of following it off the repository", () => {
  const read = readContextFile(snapshot, "leak");
  expect(read).toEqual({ state: "unavailable", path: "leak", reason: "symlink" });
  expect(JSON.stringify(read)).not.toContain("TOP-SECRET");
});

it("refuses paths that could name something outside the repository", () => {
  for (const path of ["/etc/passwd", "../outside.txt", "src/../../escape.ts", "~/.ssh/id_rsa"]) {
    expect(readContextFile(snapshot, path)).toMatchObject({ reason: "outside_repository" });
  }
});

it("names a binary, an oversized and a missing file rather than attaching an approximation", () => {
  expect(readContextFile(snapshot, "assets/logo.bin")).toMatchObject({ reason: "binary" });
  expect(readContextFile(snapshot, "huge.txt")).toMatchObject({ reason: "too_large" });
  expect(readContextFile(snapshot, "src/renamed.ts")).toMatchObject({ reason: "missing" });
});

it("refuses a directory, which has no text to attach", () => {
  expect(readContextFile(snapshot, "src")).toMatchObject({ reason: "unreadable" });
});
