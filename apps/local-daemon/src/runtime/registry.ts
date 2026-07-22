import {
  FAKE_RUNTIME_ID,
  type ProviderOptionDescriptor,
  type RuntimeAvailability,
  type RuntimeDescriptor,
  type RuntimeKind,
  type RuntimeUnavailableReason,
} from "@otomat/domain";

import { isFakeRuntimeEnabled, resolveBinaryPath } from "./availability.js";
import type { RuntimeAdapter } from "./contract.js";
import {
  CLAUDE_ADAPTER_ID,
  CLAUDE_BINARY,
  ClaudeRuntimeAdapter,
} from "./providers/claude/adapter.js";
import { CODEX_ADAPTER_ID, CODEX_BINARY, CodexRuntimeAdapter } from "./providers/codex/adapter.js";
import { FAKE_ADAPTER_ID, FakeRuntimeAdapter } from "./providers/fake/adapter.js";

interface RuntimeRegistration {
  /** One fresh adapter per turn (adapters keep per-turn state). */
  create(): RuntimeAdapter;
  kind: RuntimeKind;
  /** CLI binary probed for availability; null for the built-in simulated runtime. */
  binary: string | null;
}

const REGISTRY = {
  [CLAUDE_ADAPTER_ID]: {
    create: () => new ClaudeRuntimeAdapter(),
    kind: "real",
    binary: CLAUDE_BINARY,
  },
  [CODEX_ADAPTER_ID]: {
    create: () => new CodexRuntimeAdapter(),
    kind: "real",
    binary: CODEX_BINARY,
  },
  [FAKE_ADAPTER_ID]: {
    create: () => new FakeRuntimeAdapter(),
    kind: "simulated",
    binary: null,
  },
} as const satisfies Record<string, RuntimeRegistration>;

export type KnownRuntimeId = keyof typeof REGISTRY;

export const RUNTIME_IDS = Object.keys(REGISTRY) as KnownRuntimeId[];

export function isKnownRuntimeId(value: string): value is KnownRuntimeId {
  return value in REGISTRY;
}

export class UnknownRuntimeError extends Error {
  constructor(id: string) {
    super(`unknown runtime "${id}" (known: ${RUNTIME_IDS.join(", ")})`);
    this.name = "UnknownRuntimeError";
  }
}

export class RuntimeUnavailableError extends Error {
  constructor(
    readonly runtime: string,
    readonly reason: RuntimeUnavailableReason,
  ) {
    super(`runtime "${runtime}" is unavailable (${reason})`);
    this.name = "RuntimeUnavailableError";
  }
}

export function createRuntimeAdapter(id: string): RuntimeAdapter {
  if (!isKnownRuntimeId(id)) throw new UnknownRuntimeError(id);
  return REGISTRY[id].create();
}

/** Validates a runtime id and refuses an unavailable one (missing CLI binary, or the fake outside tests/dev) without touching state. */
export function requireAvailableRuntime(
  requested: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): KnownRuntimeId {
  const runtime = requested ?? FAKE_RUNTIME_ID;
  if (!isKnownRuntimeId(runtime)) throw new UnknownRuntimeError(runtime);
  const availability = describeRuntimeAvailability(runtime, env);
  if (availability.status === "unavailable") {
    throw new RuntimeUnavailableError(runtime, availability.reason);
  }
  return runtime;
}

/** The provider options a runtime honestly supports, for validating a profile's selected options. */
export function describeRuntimeProviderOptions(id: KnownRuntimeId): ProviderOptionDescriptor[] {
  return REGISTRY[id].create().providerOptions;
}

/** Probes without launching the provider: PATH lookup for real CLIs, the enable flag for the fake. */
export function describeRuntimeAvailability(
  id: KnownRuntimeId,
  env: NodeJS.ProcessEnv = process.env,
): RuntimeAvailability {
  const { binary } = REGISTRY[id];
  if (binary === null) {
    return isFakeRuntimeEnabled(env)
      ? { status: "available", version: null }
      : { status: "unavailable", reason: "not_enabled" };
  }
  return resolveBinaryPath(binary, env) !== null
    ? { status: "available", version: null }
    : { status: "unavailable", reason: "binary_not_found" };
}

/** The daemon's honest runtime catalog; the simulated fake is listed only when explicitly enabled. */
export function listRuntimeDescriptors(env: NodeJS.ProcessEnv = process.env): RuntimeDescriptor[] {
  return RUNTIME_IDS.filter((id) => REGISTRY[id].kind === "real" || isFakeRuntimeEnabled(env)).map(
    (id) => {
      const adapter = REGISTRY[id].create();
      return {
        id: adapter.id,
        display_name: adapter.displayName,
        kind: REGISTRY[id].kind,
        capabilities: adapter.capabilities,
        availability: describeRuntimeAvailability(id, env),
        provider_options: adapter.providerOptions,
      };
    },
  );
}
