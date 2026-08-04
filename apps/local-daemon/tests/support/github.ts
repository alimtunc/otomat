import type { PullRequestRow } from "@otomat/db";
import type { GitHubConnectionContract } from "@otomat/domain";

import type { GitHubService } from "#github";

export const CONNECTED_GITHUB: GitHubConnectionContract = {
  status: "connected",
  login: "octocat",
  device_authorization: null,
  error_code: null,
  error_message: null,
};

export const DISCONNECTED_GITHUB: GitHubConnectionContract = {
  status: "disconnected",
  login: null,
  device_authorization: null,
  error_code: "github_auth_required",
  error_message: "Sign in to GitHub to continue.",
};

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
    connection: async () => DISCONNECTED_GITHUB,
    connect: () => ({
      status: "connecting",
      login: null,
      device_authorization: null,
      error_code: null,
      error_message: null,
    }),
    getPullRequest: () => null,
    publish: async () => {
      throw new Error("publish stub not configured");
    },
    draftPullRequest: async () => {
      throw new Error("draft stub not configured");
    },
    ...overrides,
  };
}
