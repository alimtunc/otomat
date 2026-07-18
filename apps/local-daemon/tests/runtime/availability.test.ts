import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { isFakeRuntimeEnabled, resolveBinaryPath } from "#runtime/availability";

let dir: string | null = null;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

function makeDir(): string {
  dir = mkdtempSync(join(tmpdir(), "otomat-availability-"));
  return dir;
}

describe("isFakeRuntimeEnabled", () => {
  it("is off by default in a production-like env", () => {
    expect(isFakeRuntimeEnabled({})).toBe(false);
    expect(isFakeRuntimeEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isFakeRuntimeEnabled({ OTOMAT_ENABLE_FAKE_RUNTIME: "0" })).toBe(false);
  });

  it("turns on for tests and for the explicit dev opt-in", () => {
    expect(isFakeRuntimeEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(isFakeRuntimeEnabled({ VITEST: "true" })).toBe(true);
    expect(isFakeRuntimeEnabled({ OTOMAT_ENABLE_FAKE_RUNTIME: "1" })).toBe(true);
    expect(isFakeRuntimeEnabled({ OTOMAT_ENABLE_FAKE_RUNTIME: "true" })).toBe(true);
  });
});

describe("resolveBinaryPath", () => {
  it("finds an executable file on PATH", () => {
    const root = makeDir();
    const file = join(root, "claude");
    writeFileSync(file, "#!/bin/sh\nexit 0\n");
    chmodSync(file, 0o755);

    expect(resolveBinaryPath("claude", { PATH: root })).toBe(file);
  });

  it("scans PATH entries in order and skips empty segments", () => {
    const root = makeDir();
    const first = join(root, "first");
    const second = join(root, "second");
    mkdirSync(first);
    mkdirSync(second);
    for (const parent of [first, second]) {
      const file = join(parent, "codex");
      writeFileSync(file, "#!/bin/sh\nexit 0\n");
      chmodSync(file, 0o755);
    }

    const path = ["", first, second].join(delimiter);
    expect(resolveBinaryPath("codex", { PATH: path })).toBe(join(first, "codex"));
  });

  it("ignores non-executable files, directories, and missing PATH", () => {
    const root = makeDir();
    writeFileSync(join(root, "claude"), "not executable");
    chmodSync(join(root, "claude"), 0o644);
    mkdirSync(join(root, "codex"));

    expect(resolveBinaryPath("claude", { PATH: root })).toBeNull();
    expect(resolveBinaryPath("codex", { PATH: root })).toBeNull();
    expect(resolveBinaryPath("claude", {})).toBeNull();
  });
});
