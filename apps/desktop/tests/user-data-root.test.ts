import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applyUserDataRoot } from "#main/user-data-root";

const scratchDirs: string[] = [];

function scratch(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("applyUserDataRoot", () => {
  it("creates the root privately and points userData at it", () => {
    const root = join(scratch("otomat-apply-"), "Otomat Dev", "checkout-abc123");
    const assigned: [string, string][] = [];

    applyUserDataRoot(root, { setPath: (name, value) => assigned.push([name, value]) });

    expect(assigned).toEqual([["userData", root]]);
    expect(existsSync(root)).toBe(true);
    expect(statSync(root).mode & 0o777).toBe(0o700);
  });

  it("creates a channel root the same way, so no channel inherits Electron's own userData", () => {
    const root = join(scratch("otomat-apply-"), "Otomat Local");
    const assigned: [string, string][] = [];

    applyUserDataRoot(root, { setPath: (name, value) => assigned.push([name, value]) });

    expect(assigned).toEqual([["userData", root]]);
    expect(statSync(root).mode & 0o777).toBe(0o700);
  });

  it("leaves userData alone when the channel resolved no root of its own", () => {
    const assigned: string[] = [];

    applyUserDataRoot(null, { setPath: (name) => assigned.push(name) });

    expect(assigned).toEqual([]);
  });
});
