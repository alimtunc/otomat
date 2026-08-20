import type { PullRequestPatch } from "@otomat/db";

import { normalizePullRequestBody } from "./body.js";
import type { GitHubPullRequest } from "./types.js";

/** The one column set every path mirrors, so a publication, an adoption and a pass cannot drift apart. */
export function mirroredColumns(provider: GitHubPullRequest): PullRequestPatch {
  return {
    node_id: provider.nodeId,
    author_login: provider.authorLogin,
    url: provider.url,
    title: provider.title,
    body: normalizePullRequestBody(provider.body),
    head_ref: provider.headRef,
    base_ref: provider.baseRef,
    review_decision: provider.reviewDecision,
    checks_state: provider.checksState,
    mergeable: provider.mergeable,
    requested_reviewers: provider.requestedReviewers,
    provider_updated_at: provider.updatedAt,
  };
}
