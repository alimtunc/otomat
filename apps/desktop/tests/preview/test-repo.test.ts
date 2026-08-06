import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { ensureTestRepo } from "#main/preview/test-repo";

const TEMPLATE_DIR = fileURLToPath(new URL("../../resources/sandbox", import.meta.url));

// The assertions must survive the ambient git vars a `pre-push` hook exports, exactly as the
// module under test does; inherited, they would answer about the surrounding repository.
const GIT_ISOLATION_ENV_VARS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_PREFIX",
];

function git(cwd: string, args: string[]): string {
  const env = { ...process.env };
  for (const key of GIT_ISOLATION_ENV_VARS) delete env[key];
  return execFileSync("git", args, { cwd, encoding: "utf8", env, stdio: "pipe" }).trim();
}

const scratchDirs: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "otomat-sandbox-repo-"));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("ensureTestRepo", () => {
  it("creates a committed repository on main that registration would accept", () => {
    const dir = join(scratch(), "test-repo");

    expect(ensureTestRepo(dir, TEMPLATE_DIR)).toBe(true);

    expect(git(dir, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
    expect(git(dir, ["status", "--porcelain"])).toBe("");
  });

  it("rebuilds a repository whose creation died before the first commit", () => {
    const dir = join(scratch(), "test-repo");
    mkdirSync(dir, { recursive: true });
    git(dir, ["init", "-b", "main"]);

    expect(ensureTestRepo(dir, TEMPLATE_DIR)).toBe(true);

    git(dir, ["rev-parse", "--verify", "HEAD"]);
    expect(git(dir, ["status", "--porcelain"])).toBe("");
  });

  it("leaves an existing repository untouched", () => {
    const dir = join(scratch(), "test-repo");
    ensureTestRepo(dir, TEMPLATE_DIR);
    const head = git(dir, ["rev-parse", "HEAD"]);

    expect(ensureTestRepo(dir, TEMPLATE_DIR)).toBe(false);

    expect(git(dir, ["rev-parse", "HEAD"])).toBe(head);
  });

  it("ignores the repository a git hook points it at", () => {
    const outer = join(scratch(), "outer");
    mkdirSync(outer, { recursive: true });
    git(outer, ["init", "-b", "main"]);
    const dir = join(scratch(), "test-repo");

    // Exactly what `git push` exports to the pre-push hook that runs this suite.
    process.env.GIT_DIR = join(outer, ".git");
    process.env.GIT_WORK_TREE = outer;
    try {
      expect(ensureTestRepo(dir, TEMPLATE_DIR)).toBe(true);
    } finally {
      delete process.env.GIT_DIR;
      delete process.env.GIT_WORK_TREE;
    }

    expect(git(dir, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
    expect(git(outer, ["diff", "--cached", "--name-only"])).toBe("");
    expect(git(outer, ["config", "core.bare"])).toBe("false");
    expect(() => git(outer, ["rev-parse", "--verify", "HEAD"])).toThrow();
  });
});
