import type { LinearDraftRow } from "@otomat/db";
import { z } from "zod";

import type { LinearIssueDetail, LinearIssueUpdate } from "../client/types.js";
import type { LinearFieldsPayload } from "./types.js";

const fieldsPayloadSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  priority: z.number(),
  assignee_id: z.string().nullable(),
  label_ids: z.array(z.string()),
});

function labelsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

export function draftMatchesRemote(draft: LinearDraftRow, remote: LinearIssueDetail): boolean {
  return (
    draft.title === remote.title &&
    (draft.description ?? "") === (remote.description ?? "") &&
    draft.priority === remote.priority &&
    (draft.assignee_id ?? null) === (remote.assignee?.id ?? null) &&
    labelsEqual(
      draft.label_ids,
      remote.labels.map((label) => label.id),
    )
  );
}

export function fieldChanges(draft: LinearDraftRow, remote: LinearIssueDetail): LinearIssueUpdate {
  const input: LinearIssueUpdate = {};
  if (draft.title !== remote.title) input.title = draft.title;
  if ((draft.description ?? "") !== (remote.description ?? "")) {
    input.description = draft.description ?? "";
  }
  if (draft.priority !== remote.priority) input.priority = draft.priority;
  if ((draft.assignee_id ?? null) !== (remote.assignee?.id ?? null)) {
    input.assigneeId = draft.assignee_id;
  }
  if (
    !labelsEqual(
      draft.label_ids,
      remote.labels.map((label) => label.id),
    )
  ) {
    input.labelIds = draft.label_ids;
  }
  return input;
}

export function fieldsPayload(draft: LinearDraftRow): LinearFieldsPayload {
  return {
    title: draft.title,
    description: draft.description,
    priority: draft.priority,
    assignee_id: draft.assignee_id,
    label_ids: draft.label_ids,
  };
}

export function draftMatchesPayload(draft: LinearDraftRow, payload: unknown): boolean {
  const parsed = fieldsPayloadSchema.safeParse(payload);
  if (!parsed.success) return false;
  return (
    parsed.data.title === draft.title &&
    (parsed.data.description ?? null) === (draft.description ?? null) &&
    parsed.data.priority === draft.priority &&
    (parsed.data.assignee_id ?? null) === (draft.assignee_id ?? null) &&
    labelsEqual(parsed.data.label_ids, draft.label_ids)
  );
}
