import {
  modelIdSchema,
  PROVIDER_DEFAULT_MODEL,
  type ModelSelection,
  type ResolvedModel,
  type RunPlan,
  type RuntimeModelCatalog,
} from "@otomat/domain";

/** Select sentinels: a model selection is either one of these three intents or a catalog model id. */
export const MODEL_INHERIT_VALUE = "__inherit";
export const MODEL_PROVIDER_DEFAULT_VALUE = "__provider_default";
export const MODEL_CUSTOM_VALUE = "__custom";

const MODEL_CUSTOM_LABEL = "Custom identifier…";

/** Spelled out on the entry itself: "default" alone reads as "some default", not "Otomat stays out of it". */
const PROVIDER_DEFAULT_LABEL = "Provider's own default — Otomat sends no model";

/** What a run-level picker inherits from: whatever the chosen agent already carries. */
export const AGENT_MODEL_LABEL = "Agent's saved model";

/** What a step-level picker inherits from: the model the run was launched with. */
export const RUN_MODEL_LABEL = "Same model as the run";

/** How a frozen selection reads once a run is launched. Where the entry came from is said once, by the catalog, not repeated on every row. */
export function resolvedModelLabel(model: ResolvedModel | null): string {
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
  if (selection === undefined) return MODEL_INHERIT_VALUE;
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

/** Every entry a model picker offers, in display order: inherit (when offered), provider default, then the catalog. */
export function modelChoiceItems(
  catalog: RuntimeModelCatalog | undefined,
  options: { inheritLabel?: string; selected: string },
): ModelChoiceItem[] {
  const items = [
    ...(options.inheritLabel ? [{ value: MODEL_INHERIT_VALUE, label: options.inheritLabel }] : []),
    { value: MODEL_PROVIDER_DEFAULT_VALUE, label: PROVIDER_DEFAULT_LABEL },
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

/** One honest sentence about where these entries come from, or why there are none. */
export function catalogNote(
  catalog: RuntimeModelCatalog | undefined,
  isPending: boolean,
  isError: boolean,
): string | null {
  if (isPending) return "Checking the installed runtime…";
  if (isError) return "The model catalog could not be read, so only Default is offered.";
  if (!catalog) return null;
  if (!acceptsModelSelection(catalog)) return "This runtime takes no model selection.";
  return catalog.discovery.detail;
}

/** The selection a picked select value stands for; picking Custom keeps whatever identifier was already typed. */
export function modelSelectionFromValue(
  value: string,
  current: ModelSelection | undefined,
): ModelSelection | undefined {
  if (value === MODEL_INHERIT_VALUE) return undefined;
  if (value === MODEL_PROVIDER_DEFAULT_VALUE) return PROVIDER_DEFAULT_MODEL;
  if (value !== MODEL_CUSTOM_VALUE) return { kind: "model", id: value };
  return { kind: "model", id: current?.kind === "model" ? current.id : "" };
}

/** The model id whatever depends on the model is scoped to: the selection's own, else the one it inherits. Null asks for the provider's default set. */
export function effectiveModelId(
  selection: ModelSelection | undefined,
  inherited: string | null,
): string | null {
  if (selection === undefined) return inherited;
  return selection.kind === "model" ? selection.id : null;
}

/** Whether a selection can be submitted: inherit and default always can, a model needs an id the daemon will accept. */
export function isCompleteModelSelection(selection: ModelSelection | undefined): boolean {
  if (selection === undefined || selection.kind === "provider_default") return true;
  return modelIdSchema.safeParse(selection.id).success;
}

export function profileModelFromSelection(selection: ModelSelection): string | null {
  return selection.kind === "provider_default" ? null : selection.id;
}

/** The distinct models frozen across a run's executable steps, in plan order. */
export function requestedRunModels(plan: RunPlan): (ResolvedModel | null)[] {
  const requested: (ResolvedModel | null)[] = [];
  const seen = new Set<string>();
  const remember = (model: ResolvedModel | null | undefined): void => {
    const resolved = model ?? null;
    const key = resolved === null ? "default" : `${resolved.source}:${resolved.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    requested.push(resolved);
  };
  for (const node of plan.steps) {
    if ("compete" in node) {
      for (const competitor of node.compete) remember(competitor.config?.model);
      continue;
    }
    remember(node.config?.model);
  }
  return requested;
}
