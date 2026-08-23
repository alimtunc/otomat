import { contextReferenceKey, type ContextReference } from "@otomat/domain";

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

interface ContextRequestFields {
  note?: string;
  context?: ContextReference[];
}

export function contextRequestFields(draft: ContextDraft): ContextRequestFields {
  const note = draft.note.trim();
  const fields: ContextRequestFields = {};
  if (note !== "") fields.note = note;
  if (draft.references.length > 0) fields.context = [...draft.references];
  return fields;
}
