import {
  AGENT_DEFAULT_OPTION,
  type ExecutionOptionSelections,
  type ExecutionSource,
  type ModelSelection,
  type ProviderOptionKey,
  type ProviderOptionSelection,
} from "@otomat/domain";

export type ExecutionPickerLevel = Exclude<ExecutionSource, "provider">;

/** Radio sentinels: a selection is either one of these two intents or a value the runtime announced. */
export const EXECUTION_INHERIT_VALUE = "__inherit";
export const EXECUTION_AGENT_DEFAULT_VALUE = "__agent_default";

/** Only a step has both a run above it to follow and a reason to decline it by name. */
export function offersAgentDefault(level: ExecutionPickerLevel): boolean {
  return level === "step";
}

export function inheritLabel(level: ExecutionPickerLevel): string {
  return level === "step" ? "Same as the run" : "Not set here";
}

export function optionRadioValue(selection: ProviderOptionSelection | undefined): string {
  if (selection === undefined) return EXECUTION_INHERIT_VALUE;
  return selection.kind === "agent_default" ? EXECUTION_AGENT_DEFAULT_VALUE : selection.value;
}

export function optionSelectionFromRadio(value: string): ProviderOptionSelection | undefined {
  if (value === EXECUTION_INHERIT_VALUE) return undefined;
  return value === EXECUTION_AGENT_DEFAULT_VALUE ? AGENT_DEFAULT_OPTION : { kind: "value", value };
}

export interface ExecutionSelection {
  /** Encoded agent choice (profile or ad-hoc runtime); null inherits the level above. */
  agent: string | null;
  model?: ModelSelection;
  options: ExecutionOptionSelections;
}

export const EMPTY_EXECUTION_SELECTION: ExecutionSelection = { agent: null, options: {} };

/** Null asks for the provider default's option set. */
export function scopedModelId(model: ModelSelection | null): string | null {
  return model !== null && model.kind === "model" ? model.id : null;
}

export function withOptionSelection(
  selection: ExecutionSelection,
  key: ProviderOptionKey,
  next: ProviderOptionSelection | undefined,
): ExecutionSelection {
  const options = { ...selection.options };
  if (next === undefined) delete options[key];
  else options[key] = next;
  return { ...selection, options };
}

/** Another agent announces its options under other keys entirely — a permission mode is not a sandbox — so its model and options start over. */
export function withAgentSelection(agent: string | null): ExecutionSelection {
  return { agent, options: {} };
}

export function withModelSelection(
  selection: ExecutionSelection,
  model: ModelSelection | undefined,
): ExecutionSelection {
  return { ...selection, model };
}
