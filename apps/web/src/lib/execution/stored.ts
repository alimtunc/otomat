import {
  optionSelectionsFromValues,
  PROVIDER_OPTION_KEYS,
  type ProviderOptions,
} from "@otomat/domain";
import { encodeRuntimeChoice } from "@web/lib/agent-choice";

import type { ExecutionSelection } from "./selection";

export interface StoredExecution {
  runtime: string | null;
  model: string | null;
  options: ProviderOptions;
}

export function selectionFromStored(stored: StoredExecution): ExecutionSelection {
  const selection: ExecutionSelection = {
    agent: stored.runtime === null ? null : encodeRuntimeChoice(stored.runtime),
    options: optionSelectionsFromValues(stored.options),
  };
  if (stored.model !== null) selection.model = { kind: "model", id: stored.model };
  return selection;
}

/** A saved configuration holds values only, so an `agent_default` selection is dropped. */
export function storedFromSelection(
  selection: ExecutionSelection,
  runtime: string | null,
): StoredExecution {
  const options: ProviderOptions = {};
  for (const key of PROVIDER_OPTION_KEYS) {
    const selected = selection.options[key];
    if (selected?.kind === "value") options[key] = selected.value;
  }
  return {
    runtime,
    model: selection.model?.kind === "model" ? selection.model.id : null,
    options,
  };
}
