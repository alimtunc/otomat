import type { PullRequestRow, RunRow, StepRunRow } from "@otomat/db";
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
      published_head_sha: row.published_head_sha,
      generator_runtime: row.generator_runtime,
      generator_model: row.generator_model,
      generator_effort: row.generator_effort,
      error_code: row.error_code,
      error_message: row.error_message,
    },
  });
}

/** The audit of a publication decided on a run that had not succeeded; it asserts nothing about the steps it names. */
export function buildPublicationOverrideEvent(
  row: PullRequestRow,
  run: RunRow,
  steps: StepRunRow[],
): RuntimeEvent {
  return buildRuntimeEvent({
    runId: run.id,
    kind: "pr.updated",
    type: "pr.updated",
    source: "otomat",
    adapter: GITHUB_ADAPTER,
    occurredAt: new Date().toISOString(),
    payload: {
      pull_request_id: row.id,
      published_despite_run_status: run.status,
      steps: steps.map((step) => ({ name: step.name, status: step.status })),
    },
  });
}
