import type { InboxEntry, InboxEntryKind } from "../contracts/inbox.js";
import type { PullRequestInboxGroup } from "../contracts/review-inbox.js";
import { isIssueClosed } from "../state-machines/issue.js";
import type { RunState } from "../state-machines/run.js";
import type { ActivityEvidence, ActivityWindow } from "./activity.js";
import { projectPullRequestPublicationOperation } from "./publication-operation.js";
import {
  classifyPullRequestInboxGroup,
  type PullRequestInboxFacts,
  type PullRequestInboxViewerIdentity,
} from "./review-inbox.js";

const RUN_KINDS = {
  queued: null,
  preparing: null,
  running: null,
  awaiting_permission: "permission_request",
  awaiting_human: "run_awaiting_answer",
  awaiting_selection: "run_awaiting_selection",
  waiting_for_provider: "provider_quota",
  review_ready: "run_review_ready",
  completed: null,
  failed: "run_failed",
  canceled: null,
} satisfies Record<RunState, InboxEntryKind | null>;

/** Only the two groups the operator owns; a team's turn, a draft and a green pull request ask nothing of them. */
const PULL_REQUEST_KINDS = {
  needs_your_review: "pull_request_review_requested",
  needs_team_review: null,
  your_drafts: null,
  waiting_for_review: null,
  needs_action: "pull_request_blocked",
  ready_to_merge: null,
} satisfies Record<PullRequestInboxGroup, InboxEntryKind | null>;

export interface InboxPullRequestEvidence {
  pull_request_id: string;
  run_id: string | null;
  project_id: string;
  project_name: string;
  title: string;
  issue: { title: string; identifier: string | null } | null;
  facts: PullRequestInboxFacts;
  updated_at: string;
}

export interface InboxEvidence {
  runs: ActivityEvidence[];
  pull_requests: InboxPullRequestEvidence[];
  viewer: PullRequestInboxViewerIdentity;
}

/** An abandoned cycle, a superseded run and a closed issue withdraw a demand; none of them resolves it. */
function isDemanding(row: ActivityEvidence): boolean {
  return row.run_abandoned_at === null && !row.run_superseded && !isIssueClosed(row.issue_status);
}

function subjectOf(row: ActivityEvidence): InboxEntry["subject"] {
  return { title: row.issue_title, identifier: row.issue_identifier };
}

function runDetail(row: ActivityEvidence, kind: InboxEntryKind): string | null {
  if (kind === "run_failed") return row.halted_step;
  if (kind === "run_review_ready") return null;
  return row.current_step;
}

function publicationEntry(row: ActivityEvidence): InboxEntry | null {
  if (row.publication === null || !isDemanding(row)) return null;
  const operation = projectPullRequestPublicationOperation(row.publication.id, row.publication);
  if (operation === null || (operation.state !== "failed" && operation.state !== "interrupted")) {
    return null;
  }
  return {
    id: `publication:${row.publication.id}`,
    kind: "publication_stopped",
    state: "open",
    project: { id: row.project_id, name: row.project_name },
    subject: subjectOf(row),
    target: { kind: "run_pull_request", run_id: row.run_id },
    detail: operation.error?.message ?? null,
    updated_at: operation.updated_at,
  };
}

function runEntry(row: ActivityEvidence, covered: boolean): InboxEntry | null {
  const kind = RUN_KINDS[row.run_status];
  if (kind === null || !isDemanding(row)) return null;
  if (kind === "run_review_ready" && covered) return null;
  return {
    id: `run:${row.run_id}`,
    kind,
    state: "open",
    project: { id: row.project_id, name: row.project_name },
    subject: subjectOf(row),
    target: { kind: "run", run_id: row.run_id },
    detail: runDetail(row, kind),
    updated_at: row.run_updated_at,
  };
}

/** `review_ready` is the only edge into `completed`, so a completed run proves the review it asked for happened. */
function resolvedRunEntry(row: ActivityEvidence, window: ActivityWindow): InboxEntry | null {
  const withdrawn = row.run_abandoned_at !== null || row.run_superseded;
  if (row.run_status !== "completed" || withdrawn || row.run_updated_at < window.since) return null;
  return {
    id: `run:${row.run_id}`,
    kind: "run_review_ready",
    state: "resolved",
    project: { id: row.project_id, name: row.project_name },
    subject: subjectOf(row),
    target: { kind: "run", run_id: row.run_id },
    detail: null,
    updated_at: row.run_updated_at,
  };
}

function pullRequestEntry(
  row: InboxPullRequestEvidence,
  viewer: PullRequestInboxViewerIdentity,
): InboxEntry | null {
  const group = classifyPullRequestInboxGroup(row.facts, viewer);
  const kind = group === null ? null : PULL_REQUEST_KINDS[group];
  if (kind === null) return null;
  return {
    id: `pull_request:${row.pull_request_id}`,
    kind,
    state: "open",
    project: { id: row.project_id, name: row.project_name },
    subject: row.issue ?? { title: row.title, identifier: null },
    target: { kind: "pull_request", pull_request_id: row.pull_request_id },
    detail: null,
    updated_at: row.updated_at,
  };
}

function byNewest(a: InboxEntry, b: InboxEntry): number {
  return b.updated_at.localeCompare(a.updated_at);
}

/**
 * Only a completed run carries a `resolved` entry: nothing else in the evidence tells a demand that
 * was met from one that was withdrawn, so whatever merely stops asking leaves the Inbox instead.
 */
export function projectInbox(evidence: InboxEvidence, window: ActivityWindow): InboxEntry[] {
  const publications = evidence.runs.flatMap((row) => {
    const entry = publicationEntry(row);
    return entry === null || row.publication === null
      ? []
      : [{ entry, pull_request_id: row.publication.id, run_id: row.run_id }];
  });
  const stopped = new Set(publications.map((held) => held.pull_request_id));
  const pullRequests = evidence.pull_requests.flatMap((row) => {
    if (stopped.has(row.pull_request_id)) return [];
    const entry = pullRequestEntry(row, evidence.viewer);
    return entry === null ? [] : [{ entry, run_id: row.run_id }];
  });
  const covered = new Set([
    ...publications.map((held) => held.run_id),
    ...pullRequests.flatMap((held) => (held.run_id === null ? [] : [held.run_id])),
  ]);
  const open = [
    ...publications.map((held) => held.entry),
    ...pullRequests.map((held) => held.entry),
    ...evidence.runs.flatMap((row) => runEntry(row, covered.has(row.run_id)) ?? []),
  ];
  const resolved = evidence.runs.flatMap((row) => resolvedRunEntry(row, window) ?? []);
  return [...open.toSorted(byNewest), ...resolved.toSorted(byNewest).slice(0, window.limit)];
}

export function countOpenInboxEntries(entries: readonly InboxEntry[]): number {
  return entries.filter((entry) => entry.state === "open").length;
}
