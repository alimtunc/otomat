import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const injectedFailure = vi.hoisted(() => ({
  syncPath: "",
  descriptors: new Set<number>(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    closeSync: (descriptor: number): void => {
      injectedFailure.descriptors.delete(descriptor);
      original.closeSync(descriptor);
    },
    fsyncSync: (descriptor: number): void => {
      if (injectedFailure.descriptors.has(descriptor)) {
        throw new Error("injected directory synchronization failure");
      }
      original.fsyncSync(descriptor);
    },
    openSync: (path: string, flags: string | number, mode?: number): number => {
      const descriptor = original.openSync(path, flags, mode);
      if (path === injectedFailure.syncPath) injectedFailure.descriptors.add(descriptor);
      return descriptor;
    },
  };
});

import { prepareDataDirectory } from "#main/data-safety/directory";

let scratch: string | null = null;

afterEach(() => {
  injectedFailure.syncPath = "";
  injectedFailure.descriptors.clear();
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("does not publish a manifest when its directory entry cannot be synchronized", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-manifest-durability-"));
  injectedFailure.syncPath = scratch;

  expect(() => prepareDataDirectory(scratch!)).toThrow(
    expect.objectContaining({ code: "invalid_structure" }),
  );
  expect(existsSync(join(scratch, "data-layout.json"))).toBe(false);
  expect(existsSync(join(scratch, "backups"))).toBe(false);
});

it("rejects a missing manifest after durable database initialization", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-manifest-missing-"));
  const dbPath = join(scratch, "otomat.db");
  writeFileSync(dbPath, "keep");
  writeFileSync(`${dbPath}.initialized`, "");

  expect(() => prepareDataDirectory(scratch!)).toThrow(
    expect.objectContaining({ code: "unsupported_layout" }),
  );
  expect(existsSync(join(scratch, "data-layout.json"))).toBe(false);
});
