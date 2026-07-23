import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const injectedFailure = vi.hoisted(() => ({
  descriptor: null as number | null,
  manifestPath: "",
}));

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    closeSync: (descriptor: number): void => {
      if (descriptor === injectedFailure.descriptor) {
        throw new Error("injected manifest close failure");
      }
      original.closeSync(descriptor);
    },
    openSync: (path: string, flags: string | number, mode?: number): number => {
      const descriptor = original.openSync(path, flags, mode);
      if (path === injectedFailure.manifestPath) injectedFailure.descriptor = descriptor;
      return descriptor;
    },
  };
});

import { prepareDataDirectory } from "#main/data-safety/directory";

let scratch: string | null = null;

afterEach(() => {
  injectedFailure.descriptor = null;
  injectedFailure.manifestPath = "";
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("preserves a manifest read failure when handle cleanup also fails", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-manifest-errors-"));
  const manifestPath = join(scratch, "data-layout.json");
  writeFileSync(manifestPath, "invalid json");
  injectedFailure.manifestPath = manifestPath;

  let failure: unknown;
  try {
    prepareDataDirectory(scratch);
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({ code: "invalid_structure" });
  expect(failure).toHaveProperty("cause", expect.any(AggregateError));
});
