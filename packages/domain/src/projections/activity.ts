import type { ActivityBucket, ActivityContract } from "../contracts/activity.js";
import type { OperationContract, OperationState } from "../contracts/operation.js";
import type { RunState } from "../state-machines/run.js";
import {
  projectPullRequestPublicationOperation,
  type PullRequestPublicationFacts,
} from "./publication-operation.js";

const RUN_BUCKETS = {
  preparing: "running",
  running: "running",
  queued: "queued",
  waiting_for_provider: "queued",
  awaiting_permission: "attention",
  awaiting_human: "attention",
  awaiting_selection: "attention",
  review_ready: "attention",
  failed: "attention",
  completed: "recent",
  canceled: "recent",
} satisfies Record<RunState, ActivityBucket>;

const OPERATION_BUCKETS = {
  running: "running",
  succeeded: "recent",
  interrupted: "attention",
  failed: "attention",
} satisfies Record<OperationState, ActivityBucket>;

/** One run with the facts an activity is built from; `null` fields are absences the daemon read, never unknowns. */
export interface ActivityEvidence {
  run_id: string;
  run_status: RunState;
  run_updated_at: string;
  current_step: string | null;
  /** Name of the step that stopped the run, which outlives the turn that failed. */
  halted_step: string | null;
  issue_id: string;
  issue_identifier: string | null;
  issue_title: string;
  project_id: string;
  project_name: string;
  publication: (PullRequestPublicationFacts & { id: string }) | null;
}

/** How much settled work the panel still shows; both bounds apply, so a quiet host shows nothing rather than last week. */
export interface ActivityWindow {
  /** Activities that settled before this instant are dropped. */
  since: string;
  limit: number;
}

function operationPhase(operation: OperationContract): string | null {
  const reached =
    operation.phases.find((phase) => phase.state === "active") ??
    operation.phases.find((phase) => phase.state === "failed");
  return reached?.label ?? null;
}

function runActivity(row: ActivityEvidence): ActivityContract {
  return {
    kind: "run",
    id: `run:${row.run_id}`,
    bucket: RUN_BUCKETS[row.run_status],
    status: row.run_status,
    project: { id: row.project_id, name: row.project_name },
    issue: { id: row.issue_id, identifier: row.issue_identifier, title: row.issue_title },
    run_id: row.run_id,
    phase: row.current_step ?? (row.run_status === "failed" ? row.halted_step : null),
    updated_at: row.run_updated_at,
  };
}

function publicationActivity(row: ActivityEvidence): ActivityContract | null {
  if (row.publication === null) return null;
  const operation = projectPullRequestPublicationOperation(row.publication.id, row.publication);
  if (operation === null) return null;
  return {
    kind: "pull_request_publication",
    id: `publication:${row.publication.id}`,
    bucket: OPERATION_BUCKETS[operation.state],
    operation,
    project: { id: row.project_id, name: row.project_name },
    issue: { id: row.issue_id, identifier: row.issue_identifier, title: row.issue_title },
    run_id: row.run_id,
    phase: operationPhase(operation),
    updated_at: operation.updated_at,
  };
}

function byNewest(a: ActivityContract, b: ActivityContract): number {
  return b.updated_at.localeCompare(a.updated_at);
}

/** Newest first within each bucket; only the `recent` bucket is bounded, because unfinished work is never hidden. */
export function projectActivities(
  rows: ActivityEvidence[],
  window: ActivityWindow,
): ActivityContract[] {
  const live: ActivityContract[] = [];
  const recent: ActivityContract[] = [];
  for (const row of rows) {
    for (const activity of [runActivity(row), publicationActivity(row)]) {
      if (activity === null) continue;
      if (activity.bucket !== "recent") live.push(activity);
      else if (activity.updated_at >= window.since) recent.push(activity);
    }
  }
  return [...live.toSorted(byNewest), ...recent.toSorted(byNewest).slice(0, window.limit)];
}
