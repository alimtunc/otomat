import type {
  PullRequestChecksState,
  PullRequestMergeability,
  PullRequestReviewDecision,
  PullRequestReviewer,
} from "@otomat/domain";
import { z } from "zod";

export interface PullRequestReviewFacts {
  reviewDecision: PullRequestReviewDecision | null;
  checksState: PullRequestChecksState;
  mergeable: PullRequestMergeability;
  requestedReviewers: PullRequestReviewer[];
  updatedAt: string;
}

export const PR_REVIEW_FACT_FIELDS =
  "updatedAt,reviewDecision,reviewRequests,statusCheckRollup,mergeable";

const reviewRequestSchema = z.object({
  login: z.string().nullish(),
  slug: z.string().nullish(),
  name: z.string().nullish(),
});

/** A check run reports a `conclusion`; a legacy status context reports a `state`. */
const checkContextSchema = z.object({
  conclusion: z.string().nullish(),
  state: z.string().nullish(),
});

export const providerReviewFactsSchema = z.object({
  updatedAt: z.iso.datetime(),
  reviewDecision: z.string().nullish(),
  reviewRequests: z.array(reviewRequestSchema).nullish(),
  statusCheckRollup: z.array(checkContextSchema).nullish(),
  mergeable: z.string().nullish(),
});

const REVIEW_DECISIONS = new Map<string, PullRequestReviewDecision>([
  ["APPROVED", "approved"],
  ["CHANGES_REQUESTED", "changes_requested"],
  ["REVIEW_REQUIRED", "review_required"],
]);

const MERGEABILITIES = new Map<string, PullRequestMergeability>([
  ["MERGEABLE", "mergeable"],
  ["CONFLICTING", "conflicting"],
]);

const FAILED_CONCLUSIONS = new Set([
  "FAILURE",
  "TIMED_OUT",
  "CANCELLED",
  "ACTION_REQUIRED",
  "STARTUP_FAILURE",
  "STALE",
]);
const PASSED_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

type CheckContext = z.infer<typeof checkContextSchema>;

/** A context Otomat cannot read as finished counts as pending: only a reported failure fails the rollup. */
function checkOutcome(context: CheckContext): "failing" | "passing" | "pending" {
  const conclusion = (context.conclusion ?? "").toUpperCase();
  if (conclusion !== "") {
    if (FAILED_CONCLUSIONS.has(conclusion)) return "failing";
    return PASSED_CONCLUSIONS.has(conclusion) ? "passing" : "pending";
  }
  const state = (context.state ?? "").toUpperCase();
  if (state === "FAILURE" || state === "ERROR") return "failing";
  if (state === "SUCCESS") return "passing";
  return "pending";
}

function rollupChecks(contexts: readonly CheckContext[]): PullRequestChecksState {
  if (contexts.length === 0) return "none";
  const outcomes = contexts.map(checkOutcome);
  if (outcomes.includes("failing")) return "failing";
  return outcomes.includes("pending") ? "pending" : "passing";
}

/** Both sides of a team comparison are built here, so a slug is never matched across organizations. */
export function teamHandle(organization: string, slug: string): string {
  return `${organization}/${slug}`.toLowerCase();
}

function toReviewers(
  requests: readonly z.infer<typeof reviewRequestSchema>[],
  repository: string,
): PullRequestReviewer[] {
  const owner = repository.split("/")[0] ?? "";
  return requests.flatMap((request): PullRequestReviewer[] => {
    if (request.login != null) return [{ kind: "user", handle: request.login }];
    const slug = request.slug ?? request.name;
    return slug == null ? [] : [{ kind: "team", handle: teamHandle(owner, slug) }];
  });
}

export function toReviewFacts(
  parsed: z.infer<typeof providerReviewFactsSchema>,
  repository: string,
): PullRequestReviewFacts {
  return {
    reviewDecision: REVIEW_DECISIONS.get((parsed.reviewDecision ?? "").toUpperCase()) ?? null,
    checksState: rollupChecks(parsed.statusCheckRollup ?? []),
    mergeable: MERGEABILITIES.get((parsed.mergeable ?? "").toUpperCase()) ?? "unknown",
    requestedReviewers: toReviewers(parsed.reviewRequests ?? [], repository),
    updatedAt: parsed.updatedAt,
  };
}
