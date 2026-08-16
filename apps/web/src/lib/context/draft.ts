import { contextReferenceKey, type ContextReference } from "@otomat/domain";

/** What one prompt surface composes: structured references plus the single optional instruction. */
export interface ContextDraft {
  references: readonly ContextReference[];
  note: string;
}

export const EMPTY_CONTEXT_DRAFT: ContextDraft = { references: [], note: "" };

export function addContextReference(
  references: readonly ContextReference[],
  reference: ContextReference,
): readonly ContextReference[] {
  const key = contextReferenceKey(reference);
  if (references.some((entry) => contextReferenceKey(entry) === key)) return references;
  return [...references, reference];
}

export function removeContextReference(
  references: readonly ContextReference[],
  key: string,
): readonly ContextReference[] {
  return references.filter((entry) => contextReferenceKey(entry) !== key);
}

/** The request fields a draft contributes; an empty note adds no instruction rather than an empty one. */
export function contextRequestFields(draft: ContextDraft): {
  note?: string;
  context?: ContextReference[];
} {
  const note = draft.note.trim();
  return {
    ...(note === "" ? {} : { note }),
    ...(draft.references.length === 0 ? {} : { context: [...draft.references] }),
  };
}
