/**
 * GitHub connection and pull-request publication for the local daemon. GitHub
 * CLI owns authentication; this module owns honest orchestration and persistence.
 *
 * @packageDocumentation
 */
export { createGitHubCli, GitHubCliError, parseGitHubRemoteUrl } from "./cli.js";
export { runCommand } from "./process.js";
export { createGitHubService, GitHubPublicationError } from "./service.js";
export type { GitHubService, GitHubServiceConfig, PullRequestView } from "./service.js";
export type {
  CommandRequest,
  CommandResult,
  CommandRunner,
  GitHubCli,
  GitHubPullRequest,
  GitHubRemote,
  PullRequestCreateInput,
  PullRequestSelector,
  PullRequestUpdateInput,
} from "./types.js";
