import { CONTEXT_SELECTION_MAX_BYTES } from "@otomat/domain";

import type { ContextFreezer } from "#context";

import { LaunchRefusedError } from "./launch-target.js";

function kilobytes(bytes: number): string {
  return `${Math.ceil(bytes / 1000)} KB`;
}

export function withContextBudget(freeze: ContextFreezer): ContextFreezer {
  return (references, note, reviewComments) => {
    const selection = freeze(references, note, reviewComments);
    const bytes = Buffer.byteLength(JSON.stringify(selection));
    if (bytes > CONTEXT_SELECTION_MAX_BYTES) {
      const remedy =
        selection.review_comments.length > 0
          ? "fix or resolve some review comments first"
          : "attach fewer or smaller files";
      throw new LaunchRefusedError(
        "context_too_large",
        `A step's context — its issues, files, review comments and note — is ${kilobytes(bytes)}, over the ${kilobytes(CONTEXT_SELECTION_MAX_BYTES)} one step can carry; ${remedy}.`,
      );
    }
    return selection;
  };
}
