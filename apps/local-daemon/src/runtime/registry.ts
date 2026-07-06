import type { RuntimeDescriptor } from "@otomat/domain";

import type { RuntimeAdapter } from "./contract.js";
import { CLAUDE_ADAPTER_ID, ClaudeRuntimeAdapter } from "./providers/claude/adapter.js";
import { CODEX_ADAPTER_ID, CodexRuntimeAdapter } from "./providers/codex/adapter.js";
import { FAKE_ADAPTER_ID, FakeRuntimeAdapter } from "./providers/fake/adapter.js";

/** One factory per supported runtime, one fresh adapter per turn (adapters keep per-turn state); everything downstream derives from this map. */
const FACTORIES = {
  [FAKE_ADAPTER_ID]: () => new FakeRuntimeAdapter(),
  [CLAUDE_ADAPTER_ID]: () => new ClaudeRuntimeAdapter(),
  [CODEX_ADAPTER_ID]: () => new CodexRuntimeAdapter(),
} as const;

export type KnownRuntimeId = keyof typeof FACTORIES;

export const RUNTIME_IDS = Object.keys(FACTORIES) as KnownRuntimeId[];

export function isKnownRuntimeId(value: string): value is KnownRuntimeId {
  return value in FACTORIES;
}

export class UnknownRuntimeError extends Error {
  constructor(id: string) {
    super(`unknown runtime "${id}" (known: ${RUNTIME_IDS.join(", ")})`);
    this.name = "UnknownRuntimeError";
  }
}

export function createRuntimeAdapter(id: string): RuntimeAdapter {
  if (!isKnownRuntimeId(id)) throw new UnknownRuntimeError(id);
  return FACTORIES[id]();
}

/** The daemon's honest runtime catalog, served as-is to the API/UI. */
export function listRuntimeDescriptors(): RuntimeDescriptor[] {
  return RUNTIME_IDS.map((id) => {
    const adapter = createRuntimeAdapter(id);
    return {
      id: adapter.id,
      display_name: adapter.displayName,
      capabilities: adapter.capabilities,
    };
  });
}
