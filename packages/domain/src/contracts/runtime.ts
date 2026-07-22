import { z } from "zod";

/** Wire id of the built-in deterministic fake runtime — a simulated runtime for tests and explicit development only. */
export const FAKE_RUNTIME_ID = "fake";

/** Optional behaviors a runtime may advertise; absent ones degrade silently in the UI. Single source for the daemon registry and the wire contract. */
export const runtimeCapabilitiesSchema = z.object({
  stream: z.boolean(),
  /** Follow-up between turns via `resume`, never mid-turn steering. */
  send_message: z.boolean(),
  abort: z.boolean(),
  resume: z.boolean(),
  permissions: z.boolean(),
  diff_hints: z.boolean(),
});
export type RuntimeCapabilities = z.infer<typeof runtimeCapabilitiesSchema>;

/** Why a runtime cannot be used right now; safe to show verbatim in the UI. */
export const RUNTIME_UNAVAILABLE_REASONS = ["binary_not_found", "not_enabled"] as const;
export type RuntimeUnavailableReason = (typeof RUNTIME_UNAVAILABLE_REASONS)[number];

/** Probed without launching the provider: `version` is null when no safe probe reports one. */
export const runtimeAvailabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available"), version: z.string().nullable() }),
  z.object({ status: z.literal("unavailable"), reason: z.enum(RUNTIME_UNAVAILABLE_REASONS) }),
]);
export type RuntimeAvailability = z.infer<typeof runtimeAvailabilitySchema>;

/** `real` drives an installed provider CLI; `simulated` is the deterministic fake, never a normal user runtime. */
export const runtimeKindSchema = z.enum(["real", "simulated"]);
export type RuntimeKind = z.infer<typeof runtimeKindSchema>;

/** The Claude Code permission modes Otomat passes verbatim to `--permission-mode`. */
export const CLAUDE_PERMISSION_MODES = [
  "default",
  "acceptEdits",
  "plan",
  "bypassPermissions",
] as const;
export const claudePermissionModeSchema = z.enum(CLAUDE_PERMISSION_MODES);
export type ClaudePermissionMode = (typeof CLAUDE_PERMISSION_MODES)[number];

/** Every provider option a runtime may honestly expose. Keys map to a real, already-wired adapter flag. */
export const PROVIDER_OPTION_KEYS = ["permission_mode"] as const;
export const providerOptionKeySchema = z.enum(PROVIDER_OPTION_KEYS);
export type ProviderOptionKey = (typeof PROVIDER_OPTION_KEYS)[number];

/** Option values a profile/run selects. Only keys the chosen runtime advertises are accepted; the rest stay absent. */
export const providerOptionsSchema = z
  .object({
    permission_mode: claudePermissionModeSchema.optional(),
  })
  .strict();
export type ProviderOptions = z.infer<typeof providerOptionsSchema>;

/** One allowed value for a provider option, with a label safe to render. */
const providerOptionChoiceSchema = z.object({
  value: z.string(),
  label: z.string(),
});

/** A single tunable option the runtime actually honors, its allowed values and default. Drives honest option gating. */
export const providerOptionDescriptorSchema = z.object({
  key: providerOptionKeySchema,
  label: z.string(),
  choices: z.array(providerOptionChoiceSchema).min(1),
  default_value: z.string(),
});
export type ProviderOptionDescriptor = z.infer<typeof providerOptionDescriptorSchema>;

/** One runtime adapter as reported by the daemon: identity, honest capability set, probed availability, and the provider options it really supports. */
export const runtimeDescriptorSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  kind: runtimeKindSchema,
  capabilities: runtimeCapabilitiesSchema,
  availability: runtimeAvailabilitySchema,
  /** Provider options this runtime honors; empty when it exposes none. The UI hides or disables anything not listed here. */
  provider_options: z.array(providerOptionDescriptorSchema),
});
export type RuntimeDescriptor = z.infer<typeof runtimeDescriptorSchema>;
