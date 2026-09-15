import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeWorktreeFile } from "#git/file-write";
import { createGitWorktreeService } from "#git/service";
import type { GitWorktreeService } from "#git/service-contract";

import { setupGitDb, setupTestRepo, type GitTestDb, type TestRepo } from "../support/git.js";

const OWNER = "run-files";
let repo: TestRepo;
let db: GitTestDb;
let worktreesRoot: string;
let service: GitWorktreeService;
let worktree: string;

beforeEach(() => {
  repo = setupTestRepo();
  repo.write("src/app.ts", "export const a = 1;\n");
  repo.commitAll("seed");
  db = setupGitDb();
  worktreesRoot = mkdtempSync(join(tmpdir(), "otomat-files-wt-"));
  service = createGitWorktreeService({
    db: db.client.db,
    repositoryId: db.repositoryId,
    repoRoot: repo.root,
    defaultBranch: "main",
    worktreesRoot,
  });
  worktree = service.acquire({ owner: OWNER, branch: "feat/files" }).path;
});

afterEach(() => {
  rmSync(worktreesRoot, { recursive: true, force: true });
  db.cleanup();
  repo.cleanup();
});

describe("writeWorktreeFile", () => {
  const revisionOf = (path: string): string => {
    const read = service.worktreeTree(OWNER).readFile(path, { maxBytes: 1024 });
    if (read.kind !== "text") throw new Error(`expected text at ${path}, got ${read.kind}`);
    return read.oid;
  };

  it("replaces the content at the presented revision and the diff sees it", () => {
    const revision = revisionOf("src/app.ts");
    const result = writeWorktreeFile(worktree, "src/app.ts", revision, "export const a = 42;\n");

    expect(result.kind).toBe("written");
    expect(readFileSync(join(worktree, "src/app.ts"), "utf8")).toBe("export const a = 42;\n");
    expect(revisionOf("src/app.ts")).toBe(result.kind === "written" ? result.revision : "");
    expect(service.diff(OWNER).files.map((file) => file.path)).toEqual(["src/app.ts"]);
  });

  it("refuses to overwrite a file another process changed since it was read", () => {
    const revision = revisionOf("src/app.ts");
    writeFileSync(join(worktree, "src/app.ts"), "export const a = 'agent';\n");

    const result = writeWorktreeFile(worktree, "src/app.ts", revision, "mine\n");

    expect(result.kind).toBe("stale");
    expect(readFileSync(join(worktree, "src/app.ts"), "utf8")).toBe("export const a = 'agent';\n");
  });

  it("refuses symlinks, symlinked parents, .git internals and absent files", () => {
    const outside = mkdtempSync(join(tmpdir(), "otomat-outside-"));
    writeFileSync(join(outside, "target.txt"), "host\n");
    symlinkSync(join(outside, "target.txt"), join(worktree, "link.txt"));
    mkdirSync(join(worktree, "nested"));
    symlinkSync(outside, join(worktree, "nested", "escape"));
    const revision = revisionOf("src/app.ts");

    expect(writeWorktreeFile(worktree, "link.txt", revision, "x").kind).toBe("symlink");
    expect(writeWorktreeFile(worktree, "nested/escape/target.txt", revision, "x").kind).toBe(
      "symlink",
    );
    expect(writeWorktreeFile(worktree, ".git/config", revision, "x").kind).toBe("missing");
    expect(writeWorktreeFile(worktree, "nope.ts", revision, "x").kind).toBe("missing");
    expect(readFileSync(join(outside, "target.txt"), "utf8")).toBe("host\n");
    rmSync(outside, { recursive: true, force: true });
  });
});
