import type { PullRequestRow } from "@otomat/db";
import type { EventSource, EventType } from "@otomat/domain";

import { buildRuntimeEvent, type RuntimeEvent } from "#runtime";

const GITHUB_ADAPTER = "otomat-github";

export type PullRequestEventType = Extract<EventType, "pr.created" | "pr.updated">;

export function buildPullRequestEvent(
  runId: string,
  type: PullRequestEventType,
  source: EventSource,
  row: PullRequestRow,
  occurredAt: string,
): RuntimeEvent {
  return buildRuntimeEvent({
    runId,
    kind: type,
    type,
    source,
    adapter: GITHUB_ADAPTER,
    occurredAt,
    payload: {
      pull_request_id: row.id,
      status: row.status,
      publication_status: row.publication_status,
      title: row.title,
      head_ref: row.head_ref,
      base_ref: row.base_ref,
      number: row.number,
      url: row.url,
      error_code: row.error_code,
    },
  });
}
