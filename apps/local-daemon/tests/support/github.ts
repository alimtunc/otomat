import type { GitHubService } from "#github";

/** Every mutation throws unless a test overrides it; reads default to disconnected/empty. */
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
