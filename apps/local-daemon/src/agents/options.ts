import {
  effortOptionDescriptor,
  type ProviderOptionKey,
  type ProviderOptions,
  type ProviderOptionSet,
  type ResolvedModel,
} from "@otomat/domain";

import { describeProviderOptions, type KnownRuntimeId } from "#runtime";

import { ProfileOptionUnsupportedError } from "./errors.js";

/**
 * Every selected option is checked against what the installed binary announced
 * for this runtime and model, so a key or value it does not offer — including a
 * mode retired by a CLI upgrade — is refused before it can reach argv. Only what
 * the probe actually answers is enforced: `ok` and `unsupported` are answers, a
 * `failed` probe is ignorance and must not turn a working profile into a refused
 * one.
 */
function validateOptions(
  runtime: KnownRuntimeId,
  support: ProviderOptionSet,
  options: ProviderOptions,
): void {
  if (support.detection.status === "failed") return;
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    const descriptor = support.options.find((candidate) => candidate.key === key);
    if (!descriptor) {
      throw new ProfileOptionUnsupportedError(
        `runtime "${runtime}" does not offer the "${key}" option here: ${support.detection.detail}`,
      );
    }
    if (!descriptor.choices.some((choice) => choice.value === value)) {
      throw new ProfileOptionUnsupportedError(
        `runtime "${runtime}" does not accept "${key}" value "${value}"; pick one of ${descriptor.choices.map((choice) => choice.value).join(", ")}`,
      );
    }
  }
}

/**
 * The key this runtime and model announce an effort under — `--effort` for one
 * provider, `model_reasoning_effort` for another. A pair that announces no effort
 * at all (an older Claude Code, a Codex model the catalog publishes no levels
 * for, an unreadable CLI) cannot honor the request, so it is refused rather than
 * dropped behind the caller's back.
 */
function effortOptionKey(runtime: KnownRuntimeId, support: ProviderOptionSet): ProviderOptionKey {
  const descriptor = effortOptionDescriptor(support.options);
  if (!descriptor) {
    throw new ProfileOptionUnsupportedError(
      `runtime "${runtime}" announces no effort level here: ${support.detection.detail}`,
    );
  }
  return descriptor.key;
}

/** The options a config really sends: its own, plus the requested effort, each checked against the installed binary. Selecting nothing skips the probe entirely. */
export function resolveOptions(
  runtime: KnownRuntimeId,
  model: ResolvedModel | null,
  options: ProviderOptions,
  effort: string | undefined,
): ProviderOptions {
  const selected = Object.values(options).some((value) => value !== undefined);
  if (!selected && effort === undefined) return options;

  const support = describeProviderOptions(runtime, model?.id ?? null);
  const merged: ProviderOptions = { ...options };
  if (effort !== undefined) merged[effortOptionKey(runtime, support)] = effort;
  validateOptions(runtime, support, merged);
  return merged;
}
