import {
  type RuntimeAvailability,
  type RuntimeDescriptor,
  type RuntimeKind,
  type RuntimeResumeModelCapability,
} from "@otomat/domain";

import { isFakeRuntimeEnabled, resolveBinaryPath } from "./availability.js";
import type { RuntimeAdapter } from "./contract.js";
import { RuntimeUnavailableError } from "./errors.js";
import {
  CLAUDE_ADAPTER_ID,
  CLAUDE_BINARY,
  ClaudeRuntimeAdapter,
} from "./providers/claude/adapter.js";
import { claudeResumeModelCapability } from "./providers/claude/resume-model.js";
import { CODEX_ADAPTER_ID, CODEX_BINARY, CodexRuntimeAdapter } from "./providers/codex/adapter.js";
import { codexResumeModelCapability } from "./providers/codex/resume-model.js";
import { FAKE_ADAPTER_ID, FakeRuntimeAdapter } from "./providers/fake/adapter.js";

interface RuntimeRegistration {
  /** One fresh adapter per turn (adapters keep per-turn state). */
  create(): RuntimeAdapter;
  kind: RuntimeKind;
  /** CLI binary probed for availability; null for the built-in simulated runtime. */
  binary: string | null;
  resumeModel(): RuntimeResumeModelCapability;
}

const REGISTRY = {
  [CLAUDE_ADAPTER_ID]: {
    create: () => new ClaudeRuntimeAdapter(),
    kind: "real",
    binary: CLAUDE_BINARY,
    resumeModel: () => claudeResumeModelCapability(CLAUDE_BINARY),
  },
  [CODEX_ADAPTER_ID]: {
    create: () => new CodexRuntimeAdapter(),
    kind: "real",
    binary: CODEX_BINARY,
    resumeModel: () => codexResumeModelCapability(CODEX_BINARY),
  },
  [FAKE_ADAPTER_ID]: {
    create: () => new FakeRuntimeAdapter(),
    kind: "simulated",
    binary: null,
    resumeModel: () => ({ status: "supported" }),
  },
} as const satisfies Record<string, RuntimeRegistration>;

export type KnownRuntimeId = keyof typeof REGISTRY;

export const RUNTIME_IDS =
  // SAFETY: Object.keys widens to string; REGISTRY's keys are exactly the known runtime ids.
  Object.keys(REGISTRY) as KnownRuntimeId[];

export class UnknownRuntimeError extends Error {
  constructor(id: string) {
    super(`unknown runtime "${id}" (known: ${RUNTIME_IDS.join(", ")})`);
    this.name = "UnknownRuntimeError";
  }
}

export function isKnownRuntimeId(value: string): value is KnownRuntimeId {
  return value in REGISTRY;
}

export function createRuntimeAdapter(id: string): RuntimeAdapter {
  if (!isKnownRuntimeId(id)) throw new UnknownRuntimeError(id);
  return REGISTRY[id].create();
}

export function describeRuntimeResumeModelCapability(
  id: KnownRuntimeId,
): RuntimeResumeModelCapability {
  return REGISTRY[id].resumeModel();
}

/** Validates a runtime id and refuses an unavailable one (missing CLI binary, or the fake outside tests/dev) without touching state. */
export function requireAvailableRuntime(
  runtime: string,
  env: NodeJS.ProcessEnv = process.env,
): KnownRuntimeId {
  if (!isKnownRuntimeId(runtime)) throw new UnknownRuntimeError(runtime);
  const availability = describeRuntimeAvailability(runtime, env);
  if (availability.status === "unavailable") {
    throw new RuntimeUnavailableError(runtime, availability.reason);
  }
  return runtime;
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
        capabilities: {
          ...adapter.capabilities,
          resume_model: describeRuntimeResumeModelCapability(id),
        },
        availability: describeRuntimeAvailability(id, env),
      };
    },
  );
}
