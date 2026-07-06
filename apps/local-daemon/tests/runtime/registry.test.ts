import { runtimeDescriptorSchema } from "@otomat/domain";
import { describe, expect, it } from "vitest";

import { CLAUDE_ADAPTER_ID } from "#runtime/providers/claude/adapter";
import { CODEX_ADAPTER_ID } from "#runtime/providers/codex/adapter";
import { FAKE_ADAPTER_ID } from "#runtime/providers/fake/adapter";
import {
  createRuntimeAdapter,
  isKnownRuntimeId,
  listRuntimeDescriptors,
  RUNTIME_IDS,
  UnknownRuntimeError,
} from "#runtime/registry";

describe("runtime registry", () => {
  it("knows exactly the fake, claude, and codex runtimes", () => {
    expect(RUNTIME_IDS).toEqual([FAKE_ADAPTER_ID, CLAUDE_ADAPTER_ID, CODEX_ADAPTER_ID]);
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

  it("lists descriptors that satisfy the shared contract schema", () => {
    const descriptors = listRuntimeDescriptors();
    expect(descriptors.map((d) => d.id)).toEqual([...RUNTIME_IDS]);
    for (const descriptor of descriptors) {
      expect(runtimeDescriptorSchema.parse(descriptor)).toEqual(descriptor);
    }
    // Real adapters never claim the interactive permission round-trip they do not have.
    const claude = descriptors.find((d) => d.id === CLAUDE_ADAPTER_ID);
    const codex = descriptors.find((d) => d.id === CODEX_ADAPTER_ID);
    expect(claude?.capabilities.permissions).toBe(false);
    expect(codex?.capabilities.permissions).toBe(false);
    expect(claude?.capabilities.resume).toBe(true);
    expect(codex?.capabilities.resume).toBe(true);
  });
});
