import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { RemoteBaseError } from "#git/errors";
import { resolveBaseSha } from "#git/remote-base";

import { setupTestRepo, type TestRepo } from "../support/git.js";

let repo: TestRepo;

beforeEach(() => {
  repo = setupTestRepo();
});

afterEach(() => {
  repo.cleanup();
});

/** Publishes a commit and rewinds the local branch, leaving the remote ahead of the checkout. */
function advanceRemote(): string {
  repo.write("remote-only.md", "published elsewhere\n");
  const sha = repo.commitAll("remote moves on");
  repo.git("push", "--quiet", "origin", "main:refs/heads/main");
  repo.git("reset", "--hard", "HEAD~1");
  return sha;
}

it("resolves the remote head when the local base branch is behind", () => {
  const published = advanceRemote();

  expect(resolveBaseSha(repo.root, "main", false)).toBe(published);
});

it("ignores a local base branch that is ahead of its remote", () => {
  const remoteHead = repo.git("rev-parse", "main").trim();
  repo.write("local-only.md", "not published\n");
  const local = repo.commitAll("local work");

  expect(resolveBaseSha(repo.root, "main", false)).toBe(remoteHead);
  expect(resolveBaseSha(repo.root, "main", false)).not.toBe(local);
});

it("ignores uncommitted work in the checkout and leaves it untouched", () => {
  const published = advanceRemote();
  writeFileSync(join(repo.root, "scratch.md"), "work in progress\n");

  expect(resolveBaseSha(repo.root, "main", false)).toBe(published);
  expect(repo.git("status", "--porcelain")).toContain("scratch.md");
});

it("reads the branch's own configured remote ref rather than assuming the branch name", () => {
  repo.write("on-trunk.md", "trunk work\n");
  const trunk = repo.commitAll("trunk moves");
  repo.git("push", "--quiet", "origin", "main:refs/heads/trunk");
  repo.git("reset", "--hard", "HEAD~1");
  repo.git("config", "branch.main.merge", "refs/heads/trunk");

  expect(resolveBaseSha(repo.root, "main", false)).toBe(trunk);
});

it("keeps a branch the remote never had on its own local head", () => {
  repo.git("checkout", "-b", "local-only");
  repo.write("feature.md", "unpublished branch\n");
  const head = repo.commitAll("local branch work");

  expect(resolveBaseSha(repo.root, "local-only", false)).toBe(head);
});

it("refuses rather than falling back when the remote cannot be read", () => {
  repo.git("remote", "set-url", "origin", join(repo.root, "..", "gone.git"));

  expect(() => resolveBaseSha(repo.root, "main", false)).toThrow(RemoteBaseError);
});

it("refuses a repository with no remote until the caller asks for the local base", () => {
  const bare = setupTestRepo({ withoutRemote: true });
  try {
    expect(() => resolveBaseSha(bare.root, "main", false)).toThrow(RemoteBaseError);
    expect(resolveBaseSha(bare.root, "main", true)).toBe(bare.git("rev-parse", "main").trim());
  } finally {
    bare.cleanup();
  }
});

it("refuses a branch that tracks the local repository instead of a real remote", () => {
  repo.git("config", "branch.main.remote", ".");

  expect(() => resolveBaseSha(repo.root, "main", false)).toThrow(RemoteBaseError);
});

it("refuses to guess between several remotes when the branch has no upstream", () => {
  repo.git("remote", "add", "mirror", repo.root);
  repo.git("config", "--unset", "branch.main.remote");

  expect(() => resolveBaseSha(repo.root, "main", false)).toThrow(RemoteBaseError);
});
