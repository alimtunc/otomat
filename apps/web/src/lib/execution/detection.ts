import type { ProviderOptionSet } from "@otomat/domain";

export interface ExecutionDetectionErrors {
  announced: boolean;
  catalog: boolean;
  defaults: boolean;
}

/** Only the first failure is worth a sentence: once the daemon cannot answer, the ones below it say the same thing. */
export function executionDetectionProblem(errors: ExecutionDetectionErrors): string | null {
  if (errors.announced) return "The daemon could not report what this runtime accepts.";
  if (errors.catalog) return "The model catalog could not be read.";
  if (errors.defaults) return "The global defaults are missing, so this understates a launch.";
  return null;
}

/** An empty menu cannot explain itself; a menu with entries needs no sentence about them. */
export function noAnnouncedOptionsNote(set: ProviderOptionSet | undefined): string | null {
  if (set === undefined || set.options.length > 0) return null;
  return "This runtime and model announce no option Otomat can send.";
}
