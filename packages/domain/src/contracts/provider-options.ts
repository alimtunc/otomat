import { z } from "zod";

import { binaryProbeSchema } from "./probe.js";
import { modelIdSchema } from "./runtime-model.js";

export const PROVIDER_OPTION_VALUE_MAX_LENGTH = 64;

/** An option value reaches the provider verbatim as an argument, so a leading dash or whitespace would turn it into another flag. */
export const providerOptionValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(PROVIDER_OPTION_VALUE_MAX_LENGTH)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    "Option values start with a letter or digit and use letters, digits, and . _ -",
  );

const optionalValue = providerOptionValueSchema.optional();

/**
 * Every provider option Otomat can map onto a real, already-wired CLI argument,
 * one block per provider so the shape stays readable as runtimes are added. An
 * absent key means "no override": the runtime's own default applies. The key set
 * is closed because each key names a flag an adapter passes; the *values* are
 * not, because only the installed binary can say which it accepts.
 */
export const providerOptionsSchema = z
  .object({
    permission_mode: optionalValue,
    effort: optionalValue,

    sandbox: optionalValue,
    approval_policy: optionalValue,
    reasoning_effort: optionalValue,
  })
  .strict();
export type ProviderOptions = z.infer<typeof providerOptionsSchema>;

/** A provider's group may only name keys the options schema actually stores. */
type ProviderOptionKeyGroup = readonly (keyof ProviderOptions)[];

/** Claude Code: `--permission-mode`, `--effort`. */
const CLAUDE_OPTION_KEYS = ["permission_mode", "effort"] as const satisfies ProviderOptionKeyGroup;

/** Codex: `--sandbox`, `--ask-for-approval`, `-c model_reasoning_effort=…`. */
const CODEX_OPTION_KEYS = [
  "sandbox",
  "approval_policy",
  "reasoning_effort",
] as const satisfies ProviderOptionKeyGroup;

/** The flattened union every surface validates and orders against; grouping lives above. */
export const PROVIDER_OPTION_KEYS = [...CLAUDE_OPTION_KEYS, ...CODEX_OPTION_KEYS] as const;
export const providerOptionKeySchema = z.enum(PROVIDER_OPTION_KEYS);
export type ProviderOptionKey = (typeof PROVIDER_OPTION_KEYS)[number];

/** One value the installed binary announced, with what Otomat can honestly say about it. */
export const providerOptionChoiceSchema = z.object({
  value: providerOptionValueSchema,
  /** Null when neither the CLI nor its documentation defines the value; the UI then shows the value alone. */
  description: z.string().nullable(),
  /** Removes a sandbox or permission boundary: never preselected, and confirmed explicitly before it is stored. */
  dangerous: z.boolean(),
});
export type ProviderOptionChoice = z.infer<typeof providerOptionChoiceSchema>;

/** A single option the installed binary really honors, with the values it announced. */
export const providerOptionDescriptorSchema = z.object({
  key: providerOptionKeySchema,
  description: z.string().min(1),
  choices: z.array(providerOptionChoiceSchema).min(1),
  /** The value Otomat freezes and sends when no level selects one, or null when it sends no argument at all. */
  default_value: providerOptionValueSchema.nullable(),
});
export type ProviderOptionDescriptor = z.infer<typeof providerOptionDescriptorSchema>;

/** Dropped once here rather than guarded at every surface: a value that removes a boundary is only ever reached by choosing it. */
export function providerOptionDefault(descriptor: ProviderOptionDescriptor): string | null {
  const choice = descriptor.choices.find((entry) => entry.value === descriptor.default_value);
  return choice === undefined || choice.dangerous ? null : choice.value;
}

/**
 * What one runtime accepts for one model, feature-detected from the installed
 * binary. A non-`ok` detection carries no options rather than a guess, and the
 * runtime still launches on its provider defaults.
 */
export const providerOptionSetSchema = z.object({
  runtime: z.string(),
  /** The model the options were resolved for; null asked for the provider's own default model. */
  model: modelIdSchema.nullable(),
  detection: binaryProbeSchema,
  options: z.array(providerOptionDescriptorSchema),
});
export type ProviderOptionSet = z.infer<typeof providerOptionSetSchema>;

export function providerOptionDescriptor(
  options: readonly ProviderOptionDescriptor[],
  key: ProviderOptionKey,
): ProviderOptionDescriptor | null {
  return options.find((option) => option.key === key) ?? null;
}
