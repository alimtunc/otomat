import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runtimeDescriptorSchema } from "@otomat/domain";
import { afterAll, describe, expect, it } from "vitest";

import { CLAUDE_ADAPTER_ID } from "#runtime/providers/claude/adapter";
import { CODEX_ADAPTER_ID } from "#runtime/providers/codex/adapter";
import { FAKE_ADAPTER_ID } from "#runtime/providers/fake/adapter";
import {
  createRuntimeAdapter,
  describeRuntimeAvailability,
  isKnownRuntimeId,
  listRuntimeDescriptors,
  RUNTIME_IDS,
  UnknownRuntimeError,
} from "#runtime/registry";

/** Env with no fake opt-in and an empty PATH: what a production daemon without provider CLIs sees. */
const BARE_ENV: NodeJS.ProcessEnv = { PATH: "" };

const cleanups: Array<() => void> = [];

afterAll(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function binDirWith(...binaries: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "otomat-registry-bin-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  for (const binary of binaries) {
    const file = join(dir, binary);
    writeFileSync(file, "#!/bin/sh\nexit 0\n");
    chmodSync(file, 0o755);
  }
  return dir;
}

describe("runtime registry", () => {
  it("knows exactly the claude, codex, and fake runtimes", () => {
    expect(RUNTIME_IDS).toEqual([CLAUDE_ADAPTER_ID, CODEX_ADAPTER_ID, FAKE_ADAPTER_ID]);
    expect(isKnownRuntimeId("fake")).toBe(true);
    expect(isKnownRuntimeId("claude")).toBe(true);
    expect(isKnownRuntimeId("gpt-web")).toBe(false);
  });

  it("creates an adapter whose id matches the requested runtime", () => {
    for (const id of RUNTIME_IDS) {
      expect(createRuntimeAdapter(id).id).toBe(id);
    }
  });

  it("throws UnknownRuntimeError for an unregistered id", () => {
    expect(() => createRuntimeAdapter("nope")).toThrow(UnknownRuntimeError);
  });

  // The resume gate in supervisor/commands.ts trusts the declared capability; keep it truthful.
  it("declares resume exactly when the adapter implements it", () => {
    for (const id of RUNTIME_IDS) {
      const adapter = createRuntimeAdapter(id);
      expect(adapter.capabilities.resume).toBe(adapter.resume !== undefined);
    }
  });

  it("reports a real runtime unavailable when its binary is not on PATH", () => {
    expect(describeRuntimeAvailability(CLAUDE_ADAPTER_ID, BARE_ENV)).toEqual({
      status: "unavailable",
      reason: "binary_not_found",
    });
    expect(describeRuntimeAvailability(CODEX_ADAPTER_ID, BARE_ENV)).toEqual({
      status: "unavailable",
      reason: "binary_not_found",
    });
  });

  it("reports a real runtime available when its binary is executable on PATH", () => {
    const env = { PATH: binDirWith("claude") };
    expect(describeRuntimeAvailability(CLAUDE_ADAPTER_ID, env)).toEqual({
      status: "available",
      version: null,
    });
    expect(describeRuntimeAvailability(CODEX_ADAPTER_ID, env)).toEqual({
      status: "unavailable",
      reason: "binary_not_found",
    });
  });

  it("gates the fake runtime behind the explicit enable flag", () => {
    expect(describeRuntimeAvailability(FAKE_ADAPTER_ID, BARE_ENV)).toEqual({
      status: "unavailable",
      reason: "not_enabled",
    });
    expect(
      describeRuntimeAvailability(FAKE_ADAPTER_ID, { OTOMAT_ENABLE_FAKE_RUNTIME: "1" }),
    ).toEqual({ status: "available", version: null });
  });

  it("hides the fake runtime from the catalog unless explicitly enabled", () => {
    expect(listRuntimeDescriptors(BARE_ENV).map((d) => d.id)).toEqual([
      CLAUDE_ADAPTER_ID,
      CODEX_ADAPTER_ID,
    ]);
    expect(
      listRuntimeDescriptors({ PATH: "", OTOMAT_ENABLE_FAKE_RUNTIME: "1" }).map((d) => d.id),
    ).toEqual([CLAUDE_ADAPTER_ID, CODEX_ADAPTER_ID, FAKE_ADAPTER_ID]);
  });

  it("lists descriptors that satisfy the shared contract schema", () => {
    const env = { PATH: binDirWith("codex"), OTOMAT_ENABLE_FAKE_RUNTIME: "1" };
    const descriptors = listRuntimeDescriptors(env);
    for (const descriptor of descriptors) {
      expect(runtimeDescriptorSchema.parse(descriptor)).toEqual(descriptor);
    }
    const claude = descriptors.find((d) => d.id === CLAUDE_ADAPTER_ID);
    const codex = descriptors.find((d) => d.id === CODEX_ADAPTER_ID);
    const fake = descriptors.find((d) => d.id === FAKE_ADAPTER_ID);
    expect(claude).toMatchObject({
      kind: "real",
      availability: { status: "unavailable", reason: "binary_not_found" },
    });
    expect(codex).toMatchObject({ kind: "real", availability: { status: "available" } });
    expect(fake).toMatchObject({ kind: "simulated", availability: { status: "available" } });
    // Real adapters never claim the interactive permission round-trip they do not have.
    expect(claude?.capabilities.permissions).toBe(false);
    expect(codex?.capabilities.permissions).toBe(false);
    expect(claude?.capabilities.resume).toBe(true);
    expect(codex?.capabilities.resume).toBe(true);
  });
});
