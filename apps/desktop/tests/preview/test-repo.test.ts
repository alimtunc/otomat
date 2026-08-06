import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { ensureTestRepo } from "#main/preview/test-repo";

const TEMPLATE_DIR = fileURLToPath(new URL("../../resources/sandbox", import.meta.url));

const scratchDirs: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "otomat-sandbox-repo-"));
  scratchDirs.push(dir);
  return dir;
}

// Under a git hook this suite inherits GIT_DIR and friends, which would aim its own assertions —
// and the `git init` below — at the surrounding repository rather than the scratch fixture.
beforeAll(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("GIT_") && key !== "GIT_EXEC_PATH") delete process.env[key];
  }
});

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("ensureTestRepo", () => {
  it("creates a committed repository on main that registration would accept", () => {
    const dir = join(scratch(), "test-repo");

    expect(ensureTestRepo(dir, TEMPLATE_DIR)).toBe(true);

    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: dir,
      encoding: "utf8",
    }).trim();
    expect(branch).toBe("main");
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd: dir,
      encoding: "utf8",
    }).trim();
    expect(status).toBe("");
  });

  it("rebuilds a repository whose creation died before the first commit", () => {
    const dir = join(scratch(), "test-repo");
    mkdirSync(dir, { recursive: true });
    execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "pipe" });

    expect(ensureTestRepo(dir, TEMPLATE_DIR)).toBe(true);

    execFileSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: dir, stdio: "pipe" });
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd: dir,
      encoding: "utf8",
    }).trim();
    expect(status).toBe("");
  });

  it("ignores the git environment a hook exports instead of committing into that repository", () => {
    const outer = join(scratch(), "outer");
    mkdirSync(outer, { recursive: true });
    execFileSync("git", ["init", "-b", "main"], { cwd: outer, stdio: "pipe" });
    const dir = join(scratch(), "test-repo");
    process.env.GIT_DIR = join(outer, ".git");
    process.env.GIT_INDEX_FILE = join(outer, ".git", "index");

    try {
      expect(ensureTestRepo(dir, TEMPLATE_DIR)).toBe(true);
    } finally {
      delete process.env.GIT_DIR;
      delete process.env.GIT_INDEX_FILE;
    }

    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: dir,
      encoding: "utf8",
    }).trim();
    expect(branch).toBe("main");
    const outerHead = spawnSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: outer,
      stdio: "ignore",
    });
    expect(outerHead.status).not.toBe(0);
  });

  it("leaves an existing repository untouched", () => {
    const dir = join(scratch(), "test-repo");
    ensureTestRepo(dir, TEMPLATE_DIR);
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" });

    expect(ensureTestRepo(dir, TEMPLATE_DIR)).toBe(false);

    expect(execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" })).toBe(head);
  });
});
