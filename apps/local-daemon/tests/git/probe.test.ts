import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { scrubGitEnv } from "#git/git-cli";
import { probeLocalRepository, tryRealpath } from "#git/probe";

import { setupTestRepo, type TestRepo } from "../support/git.js";

let scratch: string;
let repo: TestRepo;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-probe-"));
  repo = setupTestRepo();
});

afterEach(() => {
  repo.cleanup();
  rmSync(scratch, { recursive: true, force: true });
});

it("accepts a repository root and returns its canonical path and current branch", () => {
  const probe = probeLocalRepository(repo.root);
  expect(probe).toEqual({ ok: true, rootPath: realpathSync(repo.root), defaultBranch: "main" });
});

it("resolves a symlinked path to the canonical repository root", () => {
  const link = join(scratch, "repo-link");
  symlinkSync(repo.root, link);
  const probe = probeLocalRepository(link);
  expect(probe).toEqual({ ok: true, rootPath: realpathSync(repo.root), defaultBranch: "main" });
});

it("refuses a relative path", () => {
  expect(probeLocalRepository("some/relative/path")).toEqual({
    ok: false,
    error: "path_not_absolute",
  });
});

it("refuses a path that does not exist", () => {
  expect(probeLocalRepository(join(scratch, "ghost"))).toEqual({
    ok: false,
    error: "path_not_found",
  });
});

it("refuses a file path", () => {
  const file = join(scratch, "notes.txt");
  writeFileSync(file, "x");
  expect(probeLocalRepository(file)).toEqual({ ok: false, error: "path_not_directory" });
});

it("refuses a directory that is not a git repository", () => {
  const dir = join(scratch, "plain");
  mkdirSync(dir);
  expect(probeLocalRepository(dir)).toEqual({ ok: false, error: "path_not_git_repository" });
});

it("refuses a subdirectory of a repository, pointing at the root instead", () => {
  repo.write("nested/file.txt", "x");
  expect(probeLocalRepository(join(repo.root, "nested"))).toEqual({
    ok: false,
    error: "path_not_repository_root",
  });
});

it("refuses a repository with a detached HEAD", () => {
  const head = repo.git("rev-parse", "HEAD").trim();
  repo.git("checkout", "--detach", head);
  expect(probeLocalRepository(repo.root)).toEqual({ ok: false, error: "head_detached" });
});

it("refuses a repository whose branch has no commit yet", () => {
  const bare = join(scratch, "unborn");
  mkdirSync(bare);
  execFileSync("git", ["init", "-b", "main"], { cwd: bare, env: scrubGitEnv(process.env) });
  expect(probeLocalRepository(bare)).toEqual({
    ok: false,
    error: "default_branch_undetectable",
  });
});

it("tryRealpath returns null for a missing path and the canonical path otherwise", () => {
  expect(tryRealpath(join(scratch, "nope"))).toBeNull();
  expect(tryRealpath(repo.root)).toBe(realpathSync(repo.root));
});
