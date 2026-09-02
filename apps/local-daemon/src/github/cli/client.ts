import type { GitHubConnectionContract } from "@otomat/domain";

import { cliAvailability } from "../availability.js";
import { authStatusFailed, parseAuthStatus } from "../parse.js";
import { fetchBranch, forcePushWithLease, push, remoteHead, resolveRemote } from "../remote.js";
import type { CommandRunner } from "../types.js";
import type { PullRequestViewedFiles } from "../viewed-state.js";
import { viewerTeams } from "../viewer.js";
import {
  assertCommandSucceeded,
  assertPublicationSucceeded,
  commandSucceeded,
  createPullRequestWithRetry,
  defaultSleep,
} from "./commands.js";
import type {
  ForcePushWithLeaseInput,
  GitHubCli,
  GitHubPullRequest,
  GitHubRemote,
  GitHubRepositoryTarget,
  PullRequestCreateInput,
  PullRequestListInput,
  PullRequestMergeInput,
  PullRequestModeInput,
  PullRequestOverviewFacts,
  PullRequestSearchInput,
  PullRequestSelector,
  PullRequestUpdateInput,
  RepositoryMergePolicy,
  ReviewSubmissionInput,
  ViewedFileMutationInput,
  ViewedFilesInput,
} from "./contract.js";
import {
  findPullRequest,
  listOpenPullRequests,
  searchPullRequests,
  viewPullRequest,
} from "./lookup.js";
import { mergePullRequest } from "./merge.js";
import { readRepositoryMergePolicy, viewPullRequestOverview } from "./overview.js";
import { submitPullRequestReview } from "./review-submission.js";
import { listViewedFiles, setFileViewed } from "./viewed.js";

class CommandGitHubCli implements GitHubCli {
  constructor(
    private readonly run: CommandRunner,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {}

  availability(): Promise<GitHubConnectionContract | null> {
    return cliAvailability(this.run);
  }

  /** True unless GitHub definitively answered 404: an unreachable or refused lookup errs on the branch existing. */
  async remoteBranchExists(cwd: string, repository: string, branch: string): Promise<boolean> {
    const result = await this.run({
      command: "gh",
      args: ["api", `repos/${repository}/branches/${encodeURIComponent(branch)}`],
      cwd,
    });
    if (commandSucceeded(result)) return true;
    return !result.stderr.includes("HTTP 404");
  }

  /** Guards a rewrite, so the opposite default to `remoteBranchExists`: an unreadable answer counts as protected. */
  async remoteBranchProtected(cwd: string, repository: string, branch: string): Promise<boolean> {
    const result = await this.run({
      command: "gh",
      args: [
        "api",
        `repos/${repository}/branches/${encodeURIComponent(branch)}`,
        "--jq",
        ".protected",
      ],
      cwd,
    });
    if (!commandSucceeded(result)) return true;
    return result.stdout.trim() !== "false";
  }

  async connection(): Promise<GitHubConnectionContract> {
    const unavailable = await cliAvailability(this.run);
    if (unavailable) return unavailable;
    const metadata = await this.run({
      command: "gh",
      args: ["auth", "status", "--hostname", "github.com", "--json", "hosts"],
      cwd: process.cwd(),
    });
    return commandSucceeded(metadata) ? parseAuthStatus(metadata.stdout) : authStatusFailed();
  }

  async loginWithToken(token: string): Promise<GitHubConnectionContract> {
    const loginResult = await this.run({
      command: "gh",
      args: ["auth", "login", "--hostname", "github.com", "--with-token"],
      cwd: process.cwd(),
      stdin: token,
    });
    assertCommandSucceeded(loginResult, "github_login_failed", "GitHub login did not complete.");
    const setupResult = await this.run({
      command: "gh",
      args: ["auth", "setup-git", "--hostname", "github.com"],
      cwd: process.cwd(),
    });
    assertCommandSucceeded(
      setupResult,
      "github_git_credentials_failed",
      "Git could not be configured to use the GitHub login.",
    );
    return this.connection();
  }

  resolveRemote(cwd: string): Promise<GitHubRemote> {
    return resolveRemote(this.run, cwd);
  }

  push(cwd: string, remote: string, branch: string): Promise<void> {
    return push(this.run, cwd, remote, branch);
  }

  forcePushWithLease(input: ForcePushWithLeaseInput): Promise<void> {
    return forcePushWithLease(this.run, input);
  }

  remoteHead(cwd: string, remote: string, branch: string): Promise<string | null> {
    return remoteHead(this.run, cwd, remote, branch);
  }

  fetchBranch(cwd: string, remote: string, branch: string): Promise<void> {
    return fetchBranch(this.run, cwd, remote, branch);
  }

  findPullRequest(input: PullRequestSelector): Promise<GitHubPullRequest | null> {
    return findPullRequest(this.run, input);
  }

  searchPullRequests(input: PullRequestSearchInput): Promise<GitHubPullRequest[]> {
    return searchPullRequests(this.run, input);
  }

  listOpenPullRequests(input: PullRequestListInput): Promise<GitHubPullRequest[]> {
    return listOpenPullRequests(this.run, input);
  }

  viewerTeams(cwd: string): Promise<string[] | null> {
    return viewerTeams(this.run, cwd);
  }

  viewPullRequest(cwd: string, repository: string, number: number): Promise<GitHubPullRequest> {
    return viewPullRequest(this.run, cwd, repository, number);
  }

  createPullRequest(input: PullRequestCreateInput): Promise<void> {
    return createPullRequestWithRetry(this.run, this.sleep, input);
  }

  async setPullRequestMode(input: PullRequestModeInput): Promise<void> {
    const modeResult = await this.run({
      command: "gh",
      args: [
        "pr",
        "ready",
        String(input.number),
        "--repo",
        input.repository,
        ...(input.draft ? ["--undo"] : []),
      ],
      cwd: input.cwd,
    });
    const message = input.draft
      ? "GitHub could not convert the pull request back to a draft."
      : "GitHub could not mark the pull request ready for review.";
    assertPublicationSucceeded(modeResult, "github_pr_mode_failed", message);
  }

  async updatePullRequest(input: PullRequestUpdateInput): Promise<void> {
    const updateResult = await this.run({
      command: "gh",
      args: [
        "pr",
        "edit",
        String(input.number),
        "--repo",
        input.repository,
        "--title",
        input.title,
        "--body-file",
        "-",
      ],
      cwd: input.cwd,
      stdin: input.body,
    });
    assertPublicationSucceeded(
      updateResult,
      "github_pr_update_failed",
      "GitHub could not update the pull request.",
    );
  }

  submitReview(input: ReviewSubmissionInput): Promise<{ url: string }> {
    return submitPullRequestReview(this.run, input);
  }

  viewPullRequestOverview(
    input: GitHubRepositoryTarget & { number: number },
  ): Promise<PullRequestOverviewFacts> {
    return viewPullRequestOverview(this.run, input);
  }

  readRepositoryMergePolicy(input: GitHubRepositoryTarget): Promise<RepositoryMergePolicy> {
    return readRepositoryMergePolicy(this.run, input);
  }

  mergePullRequest(input: PullRequestMergeInput): Promise<void> {
    return mergePullRequest(this.run, input);
  }

  listViewedFiles(input: ViewedFilesInput): Promise<PullRequestViewedFiles> {
    return listViewedFiles(this.run, input);
  }

  setFileViewed(input: ViewedFileMutationInput): Promise<void> {
    return setFileViewed(this.run, input);
  }
}

export function createGitHubCli(
  run: CommandRunner,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): GitHubCli {
  return new CommandGitHubCli(run, sleep);
}
