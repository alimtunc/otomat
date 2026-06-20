import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collectChangedFiles, computeCanonicalDiff, worktreeStateTree } from "./diff.js";
import { setupTestRepo, type TestRepo } from "./test-support.js";

describe("canonical diff", () => {
  let repo: TestRepo;
  let base: string;

  beforeEach(() => {
    repo = setupTestRepo();
    repo.write("keep.txt", "keep\n");
    repo.write("gone.txt", "remove me\n");
    base = repo.commitAll("seed");
  });

  afterEach(() => {
    repo.cleanup();
  });

  it("classifies modify, add, and delete against the base tree", () => {
    repo.write("README.md", "# base\nmore\n");
    repo.write("added.txt", "new\n");
    repo.remove("gone.txt");

    const files = collectChangedFiles(repo.root, base, worktreeStateTree(repo.root, base));
    const byPath = new Map(files.map((f) => [f.path, f]));

    expect(byPath.get("README.md")?.status).toBe("modified");
    expect(byPath.get("added.txt")?.status).toBe("added");
    expect(byPath.get("added.txt")?.additions).toBe(1);
    expect(byPath.get("gone.txt")?.status).toBe("deleted");
  });

  it("includes untracked files as additions", () => {
    repo.write("brand-new.txt", "a\nb\n");
    const files = collectChangedFiles(repo.root, base, worktreeStateTree(repo.root, base));
    const f = files.find((x) => x.path === "brand-new.txt");
    expect(f?.status).toBe("added");
    expect(f?.additions).toBe(2);
  });

  it("detects renames with old and new paths", () => {
    repo.write("old-name.txt", "l1\nl2\nl3\nl4\n");
    repo.commitAll("add file to rename");
    const renameBase = repo.git("rev-parse", "HEAD").trim();
    repo.write("new-name.txt", "l1\nl2\nl3\nl4\n");
    repo.remove("old-name.txt");

    const files = collectChangedFiles(
      repo.root,
      renameBase,
      worktreeStateTree(repo.root, renameBase),
    );
    const renamed = files.find((f) => f.status === "renamed");
    expect(renamed?.oldPath).toBe("old-name.txt");
    expect(renamed?.path).toBe("new-name.txt");
  });

  it("flags binary files with zero line counts", () => {
    writeFileSync(join(repo.root, "blob.bin"), Buffer.from([0, 1, 2, 0, 255, 254, 9]));
    const files = collectChangedFiles(repo.root, base, worktreeStateTree(repo.root, base));
    const bin = files.find((f) => f.path === "blob.bin");
    expect(bin?.binary).toBe(true);
    expect(bin?.additions).toBe(0);
    expect(bin?.deletions).toBe(0);
  });

  it("produces a stable sha for identical worktree state and a different one after edits", () => {
    repo.write("README.md", "# base\nmore\n");
    const d1 = computeCanonicalDiff(repo.root, base, worktreeStateTree(repo.root, base));
    const d2 = computeCanonicalDiff(repo.root, base, worktreeStateTree(repo.root, base));
    expect(d1.sha).toBe(d2.sha);
    expect(d1.sha).toMatch(/^[0-9a-f]{64}$/);

    repo.write("README.md", "# base\nmore\neven more\n");
    const d3 = computeCanonicalDiff(repo.root, base, worktreeStateTree(repo.root, base));
    expect(d3.sha).not.toBe(d1.sha);
  });

  it("carries per-file unified patch text, per-file sha, and aggregate counts", () => {
    repo.write("README.md", "# base\nmore\n");
    repo.write("added.txt", "x\n");
    const diff = computeCanonicalDiff(repo.root, base, worktreeStateTree(repo.root, base));

    const readme = diff.files.find((f) => f.path === "README.md");
    expect(readme?.patch).toContain("README.md");
    expect(readme?.patch).toContain("+more");
    expect(readme?.sha).toMatch(/^[0-9a-f]{64}$/);
    expect(diff.additions).toBeGreaterThan(0);
    expect(diff.base).toBe(base);
  });

  const EMPTY_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  it("attaches the per-file patch for paths containing whitespace", () => {
    repo.write("with space.txt", "a\nb\n");
    repo.commitAll("seed spaced file");
    const spacedBase = repo.git("rev-parse", "HEAD").trim();
    repo.write("with space.txt", "a\nb\nc\n");

    const diff = computeCanonicalDiff(
      repo.root,
      spacedBase,
      worktreeStateTree(repo.root, spacedBase),
    );
    const f = diff.files.find((x) => x.path === "with space.txt");
    expect(f?.patch).toContain("with space.txt");
    expect(f?.patch).toContain("+c");
    expect(f?.sha).not.toBe(EMPTY_SHA);
  });

  it("attaches per-file patch for renames and binaries via computeCanonicalDiff", () => {
    repo.write("ren-old.txt", "x\ny\nz\nw\n");
    writeFileSync(join(repo.root, "img.bin"), Buffer.from([0, 1, 2, 0, 9]));
    repo.commitAll("seed rename and binary base");
    const b2 = repo.git("rev-parse", "HEAD").trim();
    repo.write("ren-new.txt", "x\ny\nz\nw\n");
    repo.remove("ren-old.txt");
    writeFileSync(join(repo.root, "img.bin"), Buffer.from([0, 1, 2, 0, 9, 8, 7]));

    const diff = computeCanonicalDiff(repo.root, b2, worktreeStateTree(repo.root, b2));
    const renamed = diff.files.find((f) => f.status === "renamed");
    expect(renamed?.patch).toContain("rename to ren-new.txt");
    const bin = diff.files.find((f) => f.path === "img.bin");
    expect(bin?.binary).toBe(true);
    expect(bin?.patch).toContain("Binary files");
  });
});
