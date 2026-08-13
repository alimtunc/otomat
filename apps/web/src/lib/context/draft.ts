import { contextReferenceKey, type ContextReference } from "@otomat/domain";

/** What one prompt surface composes: structured references plus the single optional instruction. */
export interface ContextDraft {
  references: ContextReference[];
  note: string;
}

export const EMPTY_CONTEXT_DRAFT: ContextDraft = { references: [], note: "" };

export function addContextReference(
  draft: ContextDraft,
  reference: ContextReference,
): ContextDraft {
  const key = contextReferenceKey(reference);
  if (draft.references.some((entry) => contextReferenceKey(entry) === key)) return draft;
  return { ...draft, references: [...draft.references, reference] };
}

export function removeContextReference(draft: ContextDraft, key: string): ContextDraft {
  return {
    ...draft,
    references: draft.references.filter((entry) => contextReferenceKey(entry) !== key),
  };
}

/** The request fields a draft contributes; an empty note adds no instruction rather than an empty one. */
export function contextRequestFields(draft: ContextDraft): {
  note?: string;
  context?: ContextReference[];
} {
  const note = draft.note.trim();
  return {
    ...(note === "" ? {} : { note }),
    ...(draft.references.length === 0 ? {} : { context: draft.references }),
  };
}
