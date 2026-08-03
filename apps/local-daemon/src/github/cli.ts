import type { GitHubConnectionContract } from "@otomat/domain";
import { z } from "zod";

import {
  assertCommandSucceeded,
  assertPublicationSucceeded,
  createPullRequestWithRetry,
  defaultSleep,
} from "./cli-commands.js";
import {
  authStatusFailed,
  MINIMUM_GH_VERSION,
  outdatedGhVersion,
  parseAuthStatus,
  parseGitHubRemoteUrl,
  parsePullRequestJson,
  PR_JSON_FIELDS,
  providerPullRequestSchema,
  selectRemote,
  toPullRequest,
} from "./parse.js";
import type {
  CommandRunner,
  GitHubCli,
  GitHubPullRequest,
  GitHubRemote,
  PullRequestCreateInput,
  PullRequestSelector,
  PullRequestUpdateInput,
} from "./types.js";

async function cliAvailability(run: CommandRunner): Promise<GitHubConnectionContract | null> {
  const version = await run({ command: "gh", args: ["--version"], cwd: process.cwd() });
  if (version.errorCode === "ENOENT") {
    return {
      status: "not_installed",
      login: null,
      device_authorization: null,
      error_code: "github_cli_missing",
      error_message: "Install GitHub CLI to connect Otomat to GitHub.",
    };
  }
  if (version.exitCode !== 0 || version.errorCode) {
    return {
      status: "failed",
      login: null,
      device_authorization: null,
      error_code: "github_cli_failed",
      error_message: "GitHub CLI could not be started.",
    };
  }
  const outdated = outdatedGhVersion(version.stdout);
  if (outdated) {
    return {
      status: "cli_outdated",
      login: null,
      device_authorization: null,
      error_code: "github_cli_outdated",
      error_message: `GitHub CLI ${outdated} is too old; Otomat needs ${MINIMUM_GH_VERSION} or newer.`,
    };
  }
  return null;
}

class CommandGitHubCli implements GitHubCli {
  constructor(
    private readonly run: CommandRunner,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {}

  availability(): Promise<GitHubConnectionContract | null> {
    return cliAvailability(this.run);
  }

  async remoteBranchExists(cwd: string, repository: string, branch: string): Promise<boolean> {
    const result = await this.run({
      command: "gh",
      args: ["api", `repos/${repository}/branches/${encodeURIComponent(branch)}`],
      cwd,
    });
    if (result.exitCode === 0 && !result.errorCode) return true;
    return !result.stderr.includes("HTTP 404");
  }

  async connection(): Promise<GitHubConnectionContract> {
    const unavailable = await cliAvailability(this.run);
    if (unavailable) return unavailable;
    const metadata = await this.run({
      command: "gh",
      args: ["auth", "status", "--hostname", "github.com", "--json", "hosts"],
      cwd: process.cwd(),
    });
    return metadata.exitCode !== 0 || metadata.errorCode
      ? authStatusFailed()
      : parseAuthStatus(metadata.stdout);
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

  async resolveRemote(cwd: string): Promise<GitHubRemote> {
    const names = await this.run({ command: "git", args: ["remote"], cwd });
    assertPublicationSucceeded(names, "git_remote_list_failed", "Git remotes could not be read.");
    const candidates: GitHubRemote[] = [];
    for (const name of names.stdout
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean)) {
      const remoteResult = await this.run({
        command: "git",
        args: ["remote", "get-url", "--push", name],
        cwd,
      });
      if (remoteResult.exitCode !== 0 || remoteResult.errorCode) continue;
      const parsed = parseGitHubRemoteUrl(remoteResult.stdout.trim());
      if (parsed) candidates.push({ name, repository: parsed.repository });
    }
    return selectRemote(candidates);
  }

  async push(cwd: string, remote: string, branch: string): Promise<void> {
    const pushResult = await this.run({
      command: "git",
      args: ["push", "--no-verify", "--set-upstream", remote, `HEAD:refs/heads/${branch}`],
      cwd,
    });
    assertPublicationSucceeded(
      pushResult,
      "github_push_failed",
      "The run branch could not be pushed to GitHub.",
    );
  }

  async findPullRequest(input: PullRequestSelector): Promise<GitHubPullRequest | null> {
    const pullRequestResult = await this.run({
      command: "gh",
      args: [
        "pr",
        "list",
        "--repo",
        input.repository,
        "--head",
        input.head,
        "--base",
        input.base,
        "--state",
        "all",
        "--limit",
        "1",
        "--json",
        PR_JSON_FIELDS,
      ],
      cwd: input.cwd,
    });
    assertPublicationSucceeded(
      pullRequestResult,
      "github_pr_lookup_failed",
      "GitHub pull requests could not be queried.",
    );
    const rows = parsePullRequestJson(pullRequestResult.stdout, (payload) =>
      z.array(providerPullRequestSchema).parse(payload),
    );
    return rows[0] ? toPullRequest(rows[0]) : null;
  }

  async viewPullRequest(
    cwd: string,
    repository: string,
    number: number,
  ): Promise<GitHubPullRequest> {
    const pullRequestResult = await this.run({
      command: "gh",
      args: ["pr", "view", String(number), "--repo", repository, "--json", PR_JSON_FIELDS],
      cwd,
    });
    assertPublicationSucceeded(
      pullRequestResult,
      "github_pr_lookup_failed",
      "The GitHub pull request could not be read.",
    );
    return parsePullRequestJson(pullRequestResult.stdout, toPullRequest);
  }

  createPullRequest(input: PullRequestCreateInput): Promise<void> {
    return createPullRequestWithRetry(this.run, this.sleep, input);
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
}

export function createGitHubCli(
  run: CommandRunner,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): GitHubCli {
  return new CommandGitHubCli(run, sleep);
}
