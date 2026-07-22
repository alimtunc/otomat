import type { LinearIssueSnapshot, LinearTeamMetadata } from "@otomat/domain";

import type { EditorFormValues } from "../editable-fields";

export function localAssigneeName(
  local: EditorFormValues,
  metadata: LinearTeamMetadata | null,
  remote: LinearIssueSnapshot,
): string {
  if (local.assignee_id === null) return "Unassigned";
  return (
    metadata?.members.find((member) => member.id === local.assignee_id)?.name ??
    (remote.assignee?.id === local.assignee_id ? remote.assignee.name : "…")
  );
}

export function localLabelNames(
  local: EditorFormValues,
  metadata: LinearTeamMetadata | null,
  remote: LinearIssueSnapshot,
): string {
  const known = metadata?.labels ?? remote.labels;
  const names = local.label_ids.map((id) => known.find((label) => label.id === id)?.name ?? "…");
  return names.length === 0 ? "—" : names.join(", ");
}
