import { z } from "zod";

/**
 * Lean, implicit capability model: optional behaviors a runtime may support,
 * absent ones degrade silently in the UI. Deliberately not a 13-flag matrix —
 * `run` (batch execution) is always assumed; only these extras are advertised.
 * `sendMessage` means follow-up between turns via `resume`, never mid-turn steering.
 */
export const runtimeCapabilitiesSchema = z.object({
  stream: z.boolean(),
  sendMessage: z.boolean(),
  abort: z.boolean(),
  resume: z.boolean(),
  permissions: z.boolean(),
  diffHints: z.boolean(),
});

export type RuntimeCapabilities = z.infer<typeof runtimeCapabilitiesSchema>;

export const NO_CAPABILITIES: RuntimeCapabilities = {
  stream: false,
  sendMessage: false,
  abort: false,
  resume: false,
  permissions: false,
  diffHints: false,
};
