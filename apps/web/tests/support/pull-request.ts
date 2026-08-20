import type { PullRequestContract, PullRequestReviewContext } from "@otomat/domain";

export function pullRequest(overrides: Partial<PullRequestContract> = {}): PullRequestContract {
  return {
    id: "pr-1",
    issue_id: null,
    run_id: null,
    provider: "github",
    origin: "imported",
    provenance: "external",
    author_login: "contrib",
    review_decision: null,
    checks_state: "none",
    mergeable: "mergeable",
    requested_reviewers: [],
    provider_updated_at: null,
    head_sha: "a1b2c3d4",
    attachment: null,
    number: 142,
    url: "https://github.com/alimtunc/otomat/pull/142",
    status: "open",
    publication_status: "created",
    title: "Vendor anti-slop",
    body: null,
    head_ref: "contrib/fix",
    base_ref: "main",
    commit_subject: null,
    commit_body: null,
    generator: null,
    published_head_sha: null,
    published_diff_sha: null,
    error_code: null,
    error_message: null,
    ...overrides,
  };
}

export function pullRequestReviewContext(
  overrides: Partial<PullRequestContract> = {},
  issue: PullRequestReviewContext["issue"] = null,
): PullRequestReviewContext {
  return { pull_request: pullRequest(overrides), issue };
}
