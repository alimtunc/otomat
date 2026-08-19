import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { clearProviderProbeCache } from "#runtime";
import { clearCodexSandboxProbeCache } from "#runtime/providers/codex/sandbox";

/** The provider-CLI stand-in binary, injected via the adapters' binary constructor parameter. */
export const STUB_BIN = fileURLToPath(new URL("./stub-provider.mjs", import.meta.url));

export const STUB_FIXTURES = fileURLToPath(new URL("./fixtures", import.meta.url));

export function stubFixture(name: string): string {
  return join(STUB_FIXTURES, name);
}

export function setupStubHarness(prefix: string): string {
  clearProviderProbeCache();
  clearCodexSandboxProbeCache();
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * Removes the worktree and every `OTOMAT_STUB_*` knob a test set on the shared
 * process env, then drops the probe cache: the stub keeps one path and mtime
 * across tests, so a cached answer would outlive the fixture that produced it.
 */
export function teardownStubHarness(worktree: string): void {
  rmSync(worktree, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("OTOMAT_STUB_")) delete process.env[key];
  }
  clearProviderProbeCache();
  clearCodexSandboxProbeCache();
}
