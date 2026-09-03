import { z } from "zod";

import { RUN_INTERACTION_KINDS } from "./entity-states.js";

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

export const runtimeResumeModelCapabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("supported") }),
  z.object({ status: z.literal("unsupported"), reason: z.string().min(1) }),
]);
export type RuntimeResumeModelCapability = z.infer<typeof runtimeResumeModelCapabilitySchema>;

/** Which question kinds a runtime can genuinely round-trip; `unsupported` states why rather than leaving the operator to guess. */
export const runtimeInteractionCapabilitySchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("supported"),
    kinds: z.array(z.enum(RUN_INTERACTION_KINDS)).min(1),
  }),
  z.object({ status: z.literal("unsupported"), reason: z.string().min(1) }),
]);
export type RuntimeInteractionCapability = z.infer<typeof runtimeInteractionCapabilitySchema>;

export const runtimeInteractionOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});
export type RuntimeInteractionOption = z.infer<typeof runtimeInteractionOptionSchema>;

/**
 * One question as its adapter translated it — never inferred from prose.
 * `request_id` is the runtime's own correlation id, which the answer travels
 * back under; `options` is empty unless the kind is `choice`.
 */
export const runtimeInteractionRequestSchema = z.object({
  request_id: z.string().min(1),
  kind: z.enum(RUN_INTERACTION_KINDS),
  prompt: z.string().min(1),
  /** The tool the question gates, when it gates one. */
  tool: z.string().min(1).nullable(),
  options: z.array(runtimeInteractionOptionSchema),
  /** Why the runtime asked instead of deciding, in its own words; a request recorded before it said so reads as none. */
  reason: z.string().min(1).nullable().default(null),
});
export type RuntimeInteractionRequest = z.infer<typeof runtimeInteractionRequestSchema>;

/** The operator's answer, in the runtime-agnostic shape every adapter translates back into its own protocol. */
export const runtimeInteractionAnswerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("permission"), decision: z.enum(["allow", "deny"]) }),
  z.object({ kind: z.literal("choice"), values: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal("text"), text: z.string().trim().min(1) }),
]);
export type RuntimeInteractionAnswer = z.infer<typeof runtimeInteractionAnswerSchema>;

/** How a request stopped being open: the operator answered it, or it can no longer be answered and why. */
export const runtimeInteractionOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("answered"),
    request_id: z.string().min(1),
    answer: runtimeInteractionAnswerSchema,
  }),
  z.object({
    outcome: z.literal("canceled"),
    request_id: z.string().min(1),
    reason: z.string().min(1),
  }),
]);
export type RuntimeInteractionOutcome = z.infer<typeof runtimeInteractionOutcomeSchema>;

/** Optional behaviors a runtime may advertise; absent ones degrade silently in the UI. Single source for the daemon registry and the wire contract. */
export const runtimeCapabilitiesSchema = z.object({
  stream: z.boolean(),
  steering: runtimeSteeringModeSchema,
  abort: z.boolean(),
  resume: z.boolean(),
  resume_model: runtimeResumeModelCapabilitySchema,
  interactions: runtimeInteractionCapabilitySchema,
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
