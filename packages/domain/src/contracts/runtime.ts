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

/** One runtime adapter as reported by the daemon: identity, honest capability set, and probed availability. */
export const runtimeDescriptorSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  kind: runtimeKindSchema,
  capabilities: runtimeCapabilitiesSchema,
  availability: runtimeAvailabilitySchema,
});
export type RuntimeDescriptor = z.infer<typeof runtimeDescriptorSchema>;
