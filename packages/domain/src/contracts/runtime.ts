import { z } from "zod";

/** Wire id of the built-in deterministic fake runtime — a simulated runtime for tests and explicit development only. */
export const FAKE_RUNTIME_ID = "fake";

export const WORKER_JOB_ENV = "OTOMAT_WORKER_JOB";
export const WORKER_START_TOKEN_ENV = "OTOMAT_WORKER_START_TOKEN";

/** How far a runtime can carry a message that arrives while it works; a boundary is promised, never a read receipt. `live` means the invocation already running takes it. */
export const RUNTIME_STEERING_MODES = ["live", "turn_boundary", "unsupported"] as const;
export const runtimeSteeringModeSchema = z.enum(RUNTIME_STEERING_MODES);
export type RuntimeSteeringMode = z.infer<typeof runtimeSteeringModeSchema>;

/** How the permission mode a turn ran under stood on the host that ran it, so a refusal is never read as "autonomy was off". */
export const PERMISSION_MODE_STATUSES = [
  "unfrozen",
  "unannounced",
  "autonomous",
  "supervised",
] as const;
export type PermissionModeStatus = (typeof PERMISSION_MODE_STATUSES)[number];

/** How far a runtime can go in telling a quota/rate limit from a functional failure: not at all, from its own error report, or with a reset time it proves. */
export const RUNTIME_PROVIDER_LIMIT_MODES = ["unsupported", "detects", "deadline"] as const;
export const runtimeProviderLimitModeSchema = z.enum(RUNTIME_PROVIDER_LIMIT_MODES);
export type RuntimeProviderLimitMode = z.infer<typeof runtimeProviderLimitModeSchema>;

/** Optional behaviors a runtime may advertise; absent ones degrade silently in the UI. Single source for the daemon registry and the wire contract. */
export const runtimeCapabilitiesSchema = z.object({
  stream: z.boolean(),
  steering: runtimeSteeringModeSchema,
  abort: z.boolean(),
  resume: z.boolean(),
  permissions: z.boolean(),
  diff_hints: z.boolean(),
  provider_limit: runtimeProviderLimitModeSchema,
});
export type RuntimeCapabilities = z.infer<typeof runtimeCapabilitiesSchema>;

/** Why a runtime cannot be used right now; safe to show verbatim in the UI. */
export const RUNTIME_UNAVAILABLE_REASONS = [
  "binary_not_found",
  "not_enabled",
  "sandbox_unavailable",
] as const;
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

/**
 * One runtime adapter as reported by the daemon: identity, honest capability
 * set, and probed availability. Tunable provider options are deliberately
 * absent — they depend on the installed binary and the selected model, so they
 * are feature-detected per runtime through `providerOptionSetSchema` instead of
 * riding along with the list every surface polls.
 */
export const runtimeDescriptorSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  kind: runtimeKindSchema,
  capabilities: runtimeCapabilitiesSchema,
  availability: runtimeAvailabilitySchema,
});
export type RuntimeDescriptor = z.infer<typeof runtimeDescriptorSchema>;

/**
 * A quota or rate limit the provider itself reported, as the adapter read it —
 * evidence, not a decision. `resume_at` is the reset the provider printed, if any;
 * whether that reset can still be scheduled against is the daemon's call.
 */
export const providerLimitSchema = z.object({
  provider: z.string().min(1),
  /** The provider's own sentence, shown verbatim. */
  reason: z.string().min(1),
  resume_at: z.iso.datetime().nullable(),
});
export type ProviderLimit = z.infer<typeof providerLimitSchema>;
