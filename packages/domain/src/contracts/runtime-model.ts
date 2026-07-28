import { z } from "zod";

export const MODEL_ID_MAX_LENGTH = 128;

/** A model id is passed verbatim as a CLI argument value, so a leading dash or whitespace would turn it into another flag. */
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;

export const modelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MODEL_ID_MAX_LENGTH)
  .regex(
    MODEL_ID_PATTERN,
    "Model identifiers start with a letter or digit and use letters, digits, and . _ : / -",
  );

/** None of these is a claim about what the user's account may actually call. */
export const MODEL_SOURCES = ["discovered", "static", "manual"] as const;
export const modelSourceSchema = z.enum(MODEL_SOURCES);
export type ModelSource = (typeof MODEL_SOURCES)[number];

/** A catalog only ever lists provider-known entries; a typed identifier never joins it. */
export const catalogModelSourceSchema = modelSourceSchema.exclude(["manual"]);
export type CatalogModelSource = z.infer<typeof catalogModelSourceSchema>;

export const runtimeModelSchema = z.object({
  id: modelIdSchema,
  label: z.string().min(1),
  description: z.string().nullable(),
  source: catalogModelSourceSchema,
});
export type RuntimeModel = z.infer<typeof runtimeModelSchema>;

/** Only `ok` produces `discovered` entries; `unsupported` and `failed` never invent one. */
export const MODEL_DISCOVERY_STATUSES = ["ok", "unsupported", "failed"] as const;
export const modelDiscoveryStatusSchema = z.enum(MODEL_DISCOVERY_STATUSES);
export type ModelDiscoveryStatus = (typeof MODEL_DISCOVERY_STATUSES)[number];

export const modelDiscoverySchema = z.object({
  status: modelDiscoveryStatusSchema,
  detail: z.string(),
});
export type ModelDiscovery = z.infer<typeof modelDiscoverySchema>;

/** What a runtime honestly offers for model selection right now. Never an entitlement list. */
export const runtimeModelCatalogSchema = z.object({
  runtime: z.string(),
  /** Whether an identifier outside `models` may be entered by hand. */
  allows_custom: z.boolean(),
  discovery: modelDiscoverySchema,
  models: z.array(runtimeModelSchema),
});
export type RuntimeModelCatalog = z.infer<typeof runtimeModelCatalogSchema>;

/** Absence of the whole field means "inherit": from the profile for a launch, from the run default for a plan node. */
export const modelSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("provider_default") }).strict(),
  z.object({ kind: z.literal("model"), id: modelIdSchema }).strict(),
]);
export type ModelSelection = z.infer<typeof modelSelectionSchema>;

export const PROVIDER_DEFAULT_MODEL: ModelSelection = { kind: "provider_default" };

/** The stored model of a profile: null requests the provider's own default. */
export function modelSelectionFromId(id: string | null): ModelSelection {
  return id === null ? PROVIDER_DEFAULT_MODEL : { kind: "model", id };
}

/** The model frozen into a run plan. Null means the provider default was requested and no flag is sent. */
export const resolvedModelSchema = z
  .object({
    id: modelIdSchema,
    source: modelSourceSchema,
  })
  .strict();
export type ResolvedModel = z.infer<typeof resolvedModelSchema>;

/** Why a model selection was refused; safe to show verbatim in the UI. */
export const MODEL_SELECTION_ERRORS = ["model_unknown"] as const;
export type ModelSelectionError = (typeof MODEL_SELECTION_ERRORS)[number];
