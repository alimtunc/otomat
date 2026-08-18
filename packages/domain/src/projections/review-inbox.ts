import type {
  PullRequestChecksState,
  PullRequestMergeability,
  PullRequestReviewDecision,
  PullRequestReviewer,
} from "../contracts/entities/pull-request.js";
import type { PullRequestInboxEntry, PullRequestInboxGroup } from "../contracts/review-inbox.js";
import { isPullRequestLive, type PullRequestState } from "../state-machines/pull-request.js";

export interface PullRequestInboxViewerIdentity {
  login: string | null;
  teams: readonly string[];
}

export interface PullRequestInboxFacts {
  status: PullRequestState;
  author_login: string | null;
  review_decision: PullRequestReviewDecision | null;
  checks_state: PullRequestChecksState;
  mergeable: PullRequestMergeability;
  requested_reviewers: readonly PullRequestReviewer[];
}

const ACTIONABLE_GROUPS: ReadonlySet<PullRequestInboxGroup> = new Set([
  "needs_your_review",
  "needs_team_review",
  "needs_action",
  "ready_to_merge",
]);

export function countActionablePullRequestInboxEntries(
  entries: readonly PullRequestInboxEntry[],
): number {
  return entries.filter((entry) => ACTIONABLE_GROUPS.has(entry.group)).length;
}

function isReviewRequestedFrom(
  facts: PullRequestInboxFacts,
  kind: PullRequestReviewer["kind"],
  handles: readonly string[],
): boolean {
  return facts.requested_reviewers.some(
    (reviewer) => reviewer.kind === kind && handles.includes(reviewer.handle),
  );
}

function isBlocked(facts: PullRequestInboxFacts): boolean {
  return (
    facts.review_decision === "changes_requested" ||
    facts.checks_state === "failing" ||
    facts.mergeable === "conflicting"
  );
}

/** A null decision is GitHub saying the repository requires no review, not a review still missing. */
function isMergeable(facts: PullRequestInboxFacts): boolean {
  return (
    (facts.review_decision === "approved" || facts.review_decision === null) &&
    facts.checks_state !== "pending" &&
    facts.mergeable !== "unknown"
  );
}

/** The cascade order is the group priority, so an entry can never land in two groups. */
export function classifyPullRequestInboxGroup(
  facts: PullRequestInboxFacts,
  viewer: PullRequestInboxViewerIdentity,
): PullRequestInboxGroup | null {
  if (viewer.login === null) return null;
  if (!isPullRequestLive(facts.status)) return null;

  if (facts.author_login !== viewer.login) {
    if (isReviewRequestedFrom(facts, "user", [viewer.login])) return "needs_your_review";
    if (isReviewRequestedFrom(facts, "team", viewer.teams)) return "needs_team_review";
    return null;
  }
  if (isBlocked(facts)) return "needs_action";
  if (facts.status === "draft") return "your_drafts";
  return isMergeable(facts) ? "ready_to_merge" : "waiting_for_review";
}
