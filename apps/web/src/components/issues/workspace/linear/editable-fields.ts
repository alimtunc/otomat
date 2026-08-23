import type { LinearIssueDraft, LinearIssueSnapshot } from "@otomat/domain";

export const UNASSIGNED = "__unassigned__";

/** `description` is "" rather than null so the input stays controlled. */
export interface EditorFormValues {
  title: string;
  description: string;
  priority: number;
  assignee_id: string | null;
  label_ids: string[];
}

export function editableFieldsFrom(
  source: LinearIssueDraft | LinearIssueSnapshot,
): EditorFormValues {
  return {
    title: source.title,
    description: source.description ?? "",
    priority: source.priority,
    assignee_id: source.assignee_id,
    label_ids: source.label_ids,
  };
}

function labelsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

export function sameEditableFields(
  values: EditorFormValues,
  snapshot: LinearIssueSnapshot,
): boolean {
  return (
    values.title === snapshot.title &&
    values.description === (snapshot.description ?? "") &&
    values.priority === snapshot.priority &&
    (values.assignee_id ?? null) === (snapshot.assignee_id ?? null) &&
    labelsEqual(values.label_ids, snapshot.label_ids)
  );
}
