import type { LinearWriteRow } from "@otomat/db";
import type { EventType, LinearWriteKind } from "@otomat/domain";

import { buildRuntimeEvent, type RuntimeEvent } from "#runtime";

const LINEAR_ADAPTER = "otomat-linear";

export type LinearWriteEventType = Extract<
  EventType,
  "linear.status_published" | "linear.comment_published" | "linear.pr_link_published"
>;

const EVENT_TYPE_BY_KIND: Partial<Record<LinearWriteKind, LinearWriteEventType>> = {
  status: "linear.status_published",
  comment: "linear.comment_published",
  pr_link: "linear.pr_link_published",
};

/** Field edits are issue-level and carry no run, so only publish kinds map to a ledger type. */
export function linearWriteEventType(kind: LinearWriteKind): LinearWriteEventType | null {
  return EVENT_TYPE_BY_KIND[kind] ?? null;
}

export function buildLinearWriteEvent(
  runId: string,
  type: LinearWriteEventType,
  row: LinearWriteRow,
  occurredAt: string,
): RuntimeEvent {
  return buildRuntimeEvent({
    runId,
    kind: type,
    type,
    source: "linear",
    adapter: LINEAR_ADAPTER,
    occurredAt,
    payload: {
      issue_id: row.issue_id,
      write_id: row.id,
      write_kind: row.kind,
      status: row.status,
      detail: row.detail,
      remote_id: row.remote_id,
    },
  });
}
