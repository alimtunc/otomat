import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { ensureTestRepo } from "#main/preview/test-repo";

const TEMPLATE_DIR = fileURLToPath(new URL("../../resources/sandbox", import.meta.url));

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

  it("leaves an existing repository untouched", () => {
    const dir = join(scratch(), "test-repo");
    ensureTestRepo(dir, TEMPLATE_DIR);
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" });

    expect(ensureTestRepo(dir, TEMPLATE_DIR)).toBe(false);

    expect(execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" })).toBe(head);
  });
});
