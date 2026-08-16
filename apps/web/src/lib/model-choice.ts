import {
  modelIdSchema,
  PROVIDER_DEFAULT_MODEL,
  type ModelSelection,
  type ResolvedModel,
  type RuntimeModelCatalog,
} from "@otomat/domain";
import { PROVIDER_DEFAULT_MODEL_LABEL } from "@web/lib/execution/labels";
import { EXECUTION_INHERIT_VALUE } from "@web/lib/execution/selection";

/** Radio sentinels a model picker adds to the shared inherit one: a selection is either an intent or a catalog model id. */
export const MODEL_PROVIDER_DEFAULT_VALUE = "__provider_default";
export const MODEL_CUSTOM_VALUE = "__custom";

const MODEL_CUSTOM_LABEL = "Custom identifier…";

/** How a frozen selection reads once a run is launched. Where the entry came from is said once, by the catalog, not repeated on every row. */
export function frozenModelLabel(model: ResolvedModel | null): string {
  return model === null ? "Default" : model.id;
}

function isCatalogModel(catalog: RuntimeModelCatalog | undefined, id: string): boolean {
  return catalog?.models.some((model) => model.id === id) ?? false;
}

/** A runtime that lists nothing and takes no custom identifier can only run its provider default. */
function acceptsModelSelection(catalog: RuntimeModelCatalog): boolean {
  return catalog.allows_custom || catalog.models.length > 0;
}

export interface ModelChoiceItem {
  value: string;
  label: string;
}

/** The select value for a selection: a sentinel for inherit/default/custom, otherwise the listed model's id. */
export function modelSelectValue(
  selection: ModelSelection | undefined,
  catalog: RuntimeModelCatalog | undefined,
): string {
  if (selection === undefined) return EXECUTION_INHERIT_VALUE;
  if (selection.kind === "provider_default") return MODEL_PROVIDER_DEFAULT_VALUE;
  return isCatalogModel(catalog, selection.id) ? selection.id : MODEL_CUSTOM_VALUE;
}

function catalogModelItems(catalog: RuntimeModelCatalog | undefined): ModelChoiceItem[] {
  if (!catalog) return [];
  const models = catalog.models.map((model) => ({ value: model.id, label: model.label }));
  return catalog.allows_custom
    ? [...models, { value: MODEL_CUSTOM_VALUE, label: MODEL_CUSTOM_LABEL }]
    : models;
}

export interface ModelChoiceOptions {
  inheritLabel: string;
  /** False where the selection is stored rather than overridden. */
  offerProviderDefault: boolean;
  selected: string;
}

/** Every entry a model picker offers, in display order: inherit, the provider's own default where it can be stored, then the catalog. */
export function modelChoiceItems(
  catalog: RuntimeModelCatalog | undefined,
  options: ModelChoiceOptions,
): ModelChoiceItem[] {
  const items = [
    { value: EXECUTION_INHERIT_VALUE, label: options.inheritLabel },
    ...(options.offerProviderDefault
      ? [{ value: MODEL_PROVIDER_DEFAULT_VALUE, label: PROVIDER_DEFAULT_MODEL_LABEL }]
      : []),
    ...catalogModelItems(catalog),
  ];
  if (
    options.selected === MODEL_CUSTOM_VALUE &&
    !items.some((item) => item.value === MODEL_CUSTOM_VALUE)
  ) {
    items.push({ value: MODEL_CUSTOM_VALUE, label: MODEL_CUSTOM_LABEL });
  }
  return items;
}

/** Only what the list cannot say for itself: that it is still loading, unreadable, or not offered at all. */
export function catalogNote(
  catalog: RuntimeModelCatalog | undefined,
  isPending: boolean,
  isError: boolean,
): string | null {
  if (isPending) return "Checking the installed runtime…";
  if (isError) return "The model catalog could not be read, so only Default is offered.";
  if (!catalog) return null;
  return acceptsModelSelection(catalog) ? null : "This runtime takes no model selection.";
}

/** The selection a picked select value stands for; picking Custom keeps whatever identifier was already typed. */
export function modelSelectionFromValue(
  value: string,
  current: ModelSelection | undefined,
): ModelSelection | undefined {
  if (value === EXECUTION_INHERIT_VALUE) return undefined;
  if (value === MODEL_PROVIDER_DEFAULT_VALUE) return PROVIDER_DEFAULT_MODEL;
  if (value !== MODEL_CUSTOM_VALUE) return { kind: "model", id: value };
  return { kind: "model", id: current?.kind === "model" ? current.id : "" };
}

/** Whether a selection can be submitted: inherit and default always can, a model needs an id the daemon will accept. */
export function isCompleteModelSelection(selection: ModelSelection | undefined): boolean {
  if (selection === undefined || selection.kind === "provider_default") return true;
  return modelIdSchema.safeParse(selection.id).success;
}
