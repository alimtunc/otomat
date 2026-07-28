import type { GitHubConnectionContract } from "@otomat/domain";
import { z } from "zod";

import { GitHubCliError } from "./errors.js";
import {
  authStatusFailed,
  parseAuthStatus,
  parseGitHubRemoteUrl,
  parsePullRequestJson,
  PR_JSON_FIELDS,
  providerPullRequestSchema,
  selectRemote,
  toPullRequest,
} from "./parse.js";
import type {
  CommandResult,
  CommandRunner,
  GitHubCli,
  GitHubPullRequest,
  GitHubRemote,
  PullRequestCreateInput,
  PullRequestSelector,
  PullRequestUpdateInput,
} from "./types.js";

function assertCommandSucceeded(result: CommandResult, code: string, message: string): void {
  if (result.exitCode !== 0 || result.errorCode) throw new GitHubCliError(code, message);
}

async function cliAvailability(run: CommandRunner): Promise<GitHubConnectionContract | null> {
  const version = await run({ command: "gh", args: ["--version"], cwd: process.cwd() });
  if (version.errorCode === "ENOENT") {
    return {
      status: "not_installed",
      login: null,
      error_code: "github_cli_missing",
      error_message: "Install GitHub CLI to connect Otomat to GitHub.",
    };
  }
  if (version.exitCode !== 0 || version.errorCode) {
    return {
      status: "failed",
      login: null,
      error_code: "github_cli_failed",
      error_message: "GitHub CLI could not be started.",
    };
  }
  return null;
}

class CommandGitHubCli implements GitHubCli {
  constructor(private readonly run: CommandRunner) {}

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

  async login(): Promise<GitHubConnectionContract> {
    const loginResult = await this.run({
      command: "gh",
      args: [
        "auth",
        "login",
        "--hostname",
        "github.com",
        "--web",
        "--clipboard",
        "--git-protocol",
        "https",
      ],
      cwd: process.cwd(),
    });
    assertCommandSucceeded(loginResult, "github_login_failed", "GitHub login did not complete.");
    return this.connection();
  }

  async resolveRemote(cwd: string): Promise<GitHubRemote> {
    const names = await this.run({ command: "git", args: ["remote"], cwd });
    assertCommandSucceeded(names, "git_remote_list_failed", "Git remotes could not be read.");
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
      args: ["push", "--set-upstream", remote, `HEAD:refs/heads/${branch}`],
      cwd,
    });
    assertCommandSucceeded(
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
    assertCommandSucceeded(
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
    assertCommandSucceeded(
      pullRequestResult,
      "github_pr_lookup_failed",
      "The GitHub pull request could not be read.",
    );
    return parsePullRequestJson(pullRequestResult.stdout, toPullRequest);
  }

  async createPullRequest(input: PullRequestCreateInput): Promise<void> {
    const createResult = await this.run({
      command: "gh",
      args: [
        "pr",
        "create",
        "--repo",
        input.repository,
        "--base",
        input.base,
        "--head",
        input.head,
        "--title",
        input.title,
        "--body-file",
        "-",
      ],
      cwd: input.cwd,
      stdin: input.body,
    });
    assertCommandSucceeded(
      createResult,
      "github_pr_create_failed",
      "GitHub could not create the pull request.",
    );
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
    assertCommandSucceeded(
      updateResult,
      "github_pr_update_failed",
      "GitHub could not update the pull request.",
    );
  }
}

export function createGitHubCli(run: CommandRunner): GitHubCli {
  return new CommandGitHubCli(run);
}
