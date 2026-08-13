import { modelSelectionFromId, type ExecutionDefaults } from "@otomat/domain";

import { isKnownRuntimeId, resolveModelSelection, UnknownRuntimeError } from "#runtime";

import { assertOptionsAnnounced } from "./options.js";

/** Availability is deliberately not required: a preference may be set before its CLI is installed, and a launch that falls back to it is refused there. */
export function validateExecutionDefaults(defaults: ExecutionDefaults): void {
  if (defaults.runtime === null) return;
  if (!isKnownRuntimeId(defaults.runtime)) throw new UnknownRuntimeError(defaults.runtime);
  const model = resolveModelSelection(defaults.runtime, modelSelectionFromId(defaults.model));
  assertOptionsAnnounced(defaults.runtime, model, defaults.options);
}
