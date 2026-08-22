import { z } from "zod";

import {
  providerOptionKeySchema,
  providerOptionsSchema,
  providerOptionValueSchema,
} from "./provider-options.js";
import { modelIdSchema } from "./runtime-model.js";

/** Ordered most specific first; `provider` means nothing selected, so Otomat sends no argument. */
const EXECUTION_SOURCES = ["turn", "step", "launch", "profile", "global", "provider"] as const;
const executionSourceSchema = z.enum(EXECUTION_SOURCES);
export type ExecutionSource = z.infer<typeof executionSourceSchema>;

/** An absent entry inherits the level above; `agent_default` skips every override above the agent instead. */
export const providerOptionSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("agent_default") }).strict(),
  z.object({ kind: z.literal("value"), value: providerOptionValueSchema }).strict(),
]);
export type ProviderOptionSelection = z.infer<typeof providerOptionSelectionSchema>;

export const AGENT_DEFAULT_OPTION: ProviderOptionSelection = { kind: "agent_default" };

export const executionOptionSelectionsSchema = z.partialRecord(
  providerOptionKeySchema,
  providerOptionSelectionSchema,
);
export type ExecutionOptionSelections = z.infer<typeof executionOptionSelectionsSchema>;

export const resolvedExecutionSourcesSchema = z.object({
  runtime: executionSourceSchema,
  model: executionSourceSchema,
  options: z.partialRecord(providerOptionKeySchema, executionSourceSchema),
});
export type ResolvedExecutionSources = z.infer<typeof resolvedExecutionSourcesSchema>;

/** An option key names a flag of the CLI that announced it, so the model and options belong to `runtime` alone. */
export const executionDefaultsSchema = z
  .object({
    /** A stored runtime must still be available on this host at launch. */
    runtime: z.string().min(1).nullable(),
    model: modelIdSchema.nullable(),
    options: providerOptionsSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.runtime !== null ||
      (value.model === null && Object.values(value.options).every((v) => v === undefined)),
    { message: "Execution defaults without a runtime carry no model or options" },
  );
export type ExecutionDefaults = z.infer<typeof executionDefaultsSchema>;

export const EMPTY_EXECUTION_DEFAULTS: ExecutionDefaults = {
  runtime: null,
  model: null,
  options: {},
};
