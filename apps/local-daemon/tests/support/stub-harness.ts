import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The provider-CLI stand-in binary, injected via the adapters' binary constructor parameter. */
export const STUB_BIN = fileURLToPath(new URL("./stub-provider.mjs", import.meta.url));

export const STUB_FIXTURES = fileURLToPath(new URL("./fixtures", import.meta.url));

export function setupStubHarness(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Removes the worktree and every `OTOMAT_STUB_*` knob a test set on the shared process env. */
export function teardownStubHarness(worktree: string): void {
  rmSync(worktree, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("OTOMAT_STUB_")) delete process.env[key];
  }
}
