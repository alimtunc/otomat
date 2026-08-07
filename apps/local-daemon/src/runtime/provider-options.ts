import type { ProviderOptionSet } from "@otomat/domain";

import { createRuntimeAdapter, type KnownRuntimeId } from "./registry.js";

/**
 * What the installed binary accepts for this runtime and model. The adapter
 * feature-detects it per call and the underlying probe is cached by binary
 * version, so a CLI upgrade changes the answer without a daemon restart.
 */
export function describeProviderOptions(
  runtime: KnownRuntimeId,
  model: string | null,
): ProviderOptionSet {
  return { runtime, model, ...createRuntimeAdapter(runtime).describeOptions(model) };
}
