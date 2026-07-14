import type { PullRequestRow } from "@otomat/db";

import type { GitHubService } from "#github";

export function pullRequestRow(overrides: Partial<PullRequestRow> = {}): PullRequestRow {
  return {
    id: "pr1",
    run_id: "run-detail",
    provider: "github",
    number: null,
    url: null,
    status: "draft",
    publication_status: "not_configured",
    title: "First slice",
    body: null,
    head_ref: null,
    base_ref: null,
    published_head_sha: null,
    published_diff_sha: null,
    error_code: null,
    error_message: null,
    created_at: "2026-07-05T00:00:00.000Z",
    updated_at: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

export function stubGitHubService(overrides: Partial<GitHubService> = {}): GitHubService {
  return {
    connection: async () => ({
      status: "disconnected",
      login: null,
      error_code: "github_auth_required",
      error_message: "Sign in to GitHub to continue.",
    }),
    connect: () => ({
      status: "connecting",
      login: null,
      error_code: null,
      error_message: null,
    }),
    getPullRequest: () => null,
    publish: async () => {
      throw new Error("publish stub not configured");
    },
    ...overrides,
  };
}
