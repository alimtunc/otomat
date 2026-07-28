import type { ModelSelection, ModelSelectionError, ResolvedModel } from "@otomat/domain";

import type { KnownRuntimeId } from "../registry.js";
import { describeRuntimeModelCatalog } from "./catalog.js";

/** A model the runtime cannot honestly accept. The launch is refused; another model is never substituted. */
export class ModelSelectionRefusedError extends Error {
  constructor(
    readonly code: ModelSelectionError,
    message: string,
  ) {
    super(message);
    this.name = "ModelSelectionRefusedError";
  }
}

export function resolveModelSelection(
  runtime: KnownRuntimeId,
  selection: ModelSelection,
): ResolvedModel | null {
  if (selection.kind === "provider_default") return null;

  const catalog = describeRuntimeModelCatalog(runtime);
  const listed = catalog.models.find((model) => model.id === selection.id);
  if (listed) return { id: listed.id, source: listed.source };
  if (catalog.allows_custom) return { id: selection.id, source: "manual" };
  throw new ModelSelectionRefusedError(
    "model_unknown",
    `runtime "${runtime}" does not list model "${selection.id}" and accepts no custom identifier`,
  );
}
