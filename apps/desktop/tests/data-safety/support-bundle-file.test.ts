import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const injectedFailure = vi.hoisted(() => ({ fchmod: false }));

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp"),
    getVersion: vi.fn(() => "0.0.0"),
  },
  dialog: {
    showMessageBox: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    fchmodSync: (descriptor: number, mode: number): void => {
      if (injectedFailure.fchmod) throw new Error("injected fchmod failure");
      original.fchmodSync(descriptor, mode);
    },
  };
});

import { writeSupportBundleAtomically } from "#main/data-safety/support-bundle-file";

let scratch: string | null = null;

afterEach(() => {
  injectedFailure.fchmod = false;
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("keeps the previous bundle and removes its temporary file when finalization fails", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-support-write-"));
  const destination = join(scratch, "support.json");
  writeFileSync(destination, "previous bundle");
  injectedFailure.fchmod = true;

  expect(() => writeSupportBundleAtomically(destination, "new bundle")).toThrow(/atomically/);
  expect(readFileSync(destination, "utf8")).toBe("previous bundle");
  expect(readdirSync(scratch)).toEqual(["support.json"]);
});
