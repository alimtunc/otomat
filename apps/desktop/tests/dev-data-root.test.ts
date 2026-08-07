import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveDevDataRoot } from "#main/dev-data-root";

const scratchDirs: string[] = [];

function scratch(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

function devRootFor(repoRoot: string, appData: string, env: NodeJS.ProcessEnv = {}): string {
  return resolveDevDataRoot({ repoRoot, appData, env });
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("resolveDevDataRoot", () => {
  it("derives a stable root outside the checkout and beside — not inside — packaged app data", () => {
    const appData = scratch("otomat-appdata-");
    const worktree = scratch("otomat-worktree-");

    const root = devRootFor(worktree, appData);

    expect(root).toBe(devRootFor(worktree, appData));
    expect(root.startsWith(`${appData}${sep}Otomat Dev${sep}`)).toBe(true);
    expect(root.startsWith(`${worktree}${sep}`)).toBe(false);
    expect(root).not.toBe(join(appData, "Otomat"));
  });

  it("gives two worktrees disjoint roots that still name their checkout", () => {
    const appData = scratch("otomat-appdata-");
    const first = scratch("otomat-worktree-a-");
    const second = scratch("otomat-worktree-b-");

    const firstRoot = devRootFor(first, appData);
    const secondRoot = devRootFor(second, appData);

    expect(firstRoot).not.toBe(secondRoot);
    expect(firstRoot).toContain("otomat-worktree-a-");
    expect(secondRoot).toContain("otomat-worktree-b-");
  });

  it("keys on the canonical real path, so a symlinked checkout is the same session", () => {
    const appData = scratch("otomat-appdata-");
    const parent = scratch("otomat-links-");
    const worktree = join(parent, "checkout");
    const link = join(parent, "checkout-link");
    mkdirSync(worktree);
    symlinkSync(worktree, link);

    expect(devRootFor(link, appData)).toBe(devRootFor(worktree, appData));
  });

  it("honours an absolute override and rejects a relative one", () => {
    const appData = scratch("otomat-appdata-");
    const worktree = scratch("otomat-worktree-");
    const override = join(scratch("otomat-override-"), "session");

    expect(devRootFor(worktree, appData, { OTOMAT_DESKTOP_DEV_DATA_ROOT: override })).toBe(
      override,
    );
    expect(() =>
      resolveDevDataRoot({
        repoRoot: worktree,
        appData,
        env: { OTOMAT_DESKTOP_DEV_DATA_ROOT: "relative/session" },
      }),
    ).toThrow(/absolute path/);
  });

  it("ignores a blank override rather than treating it as a root", () => {
    const appData = scratch("otomat-appdata-");
    const worktree = scratch("otomat-worktree-");

    expect(devRootFor(worktree, appData, { OTOMAT_DESKTOP_DEV_DATA_ROOT: "  " })).toBe(
      devRootFor(worktree, appData),
    );
  });
});
