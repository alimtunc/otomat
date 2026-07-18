import type { GitHubConnectionContract, PullRequestState } from "@otomat/domain";
import { z } from "zod";

import { normalizePullRequestBody } from "./body.js";
import { GitHubCliError } from "./errors.js";
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

const providerPullRequestSchema = z.object({
  number: z.number().int().positive(),
  url: z.url(),
  title: z.string(),
  body: z.string().nullable(),
  headRefName: z.string().min(1),
  baseRefName: z.string().min(1),
  state: z.enum(["OPEN", "CLOSED", "MERGED"]),
  isDraft: z.boolean(),
});

const authStatusSchema = z.object({
  hosts: z.record(
    z.string(),
    z.array(
      z.object({
        state: z.string(),
        active: z.boolean(),
        host: z.string(),
        login: z.string(),
      }),
    ),
  ),
});

const PR_JSON_FIELDS = "number,url,title,body,headRefName,baseRefName,state,isDraft";

function assertCommandSucceeded(result: CommandResult, code: string, message: string): void {
  if (result.exitCode !== 0 || result.errorCode) throw new GitHubCliError(code, message);
}

function lifecycle(state: "OPEN" | "CLOSED" | "MERGED", draft: boolean): PullRequestState {
  if (state === "MERGED") return "merged";
  if (state === "CLOSED") return "closed";
  return draft ? "draft" : "open";
}

function toPullRequest(value: unknown): GitHubPullRequest {
  const parsed = providerPullRequestSchema.parse(value);
  return {
    number: parsed.number,
    url: parsed.url,
    title: parsed.title,
    body: normalizePullRequestBody(parsed.body),
    headRef: parsed.headRefName,
    baseRef: parsed.baseRefName,
    lifecycle: lifecycle(parsed.state, parsed.isDraft),
  };
}

function parsePullRequestJson<T>(stdout: string, parse: (payload: unknown) => T): T {
  try {
    return parse(JSON.parse(stdout));
  } catch {
    throw new GitHubCliError(
      "github_pr_response_invalid",
      "GitHub returned invalid pull request metadata.",
    );
  }
}

function repositoryFromPath(pathname: string): string | null {
  const parts = pathname
    .replace(/^\//, "")
    .replace(/\.git$/, "")
    .split("/");
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) return null;
  return `${parts[0]}/${parts[1]}`;
}

export function parseGitHubRemoteUrl(url: string): { repository: string } | null {
  const scp = /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
  if (scp?.[1]) return { repository: scp[1] };

  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== "github.com") return null;
    if (parsed.protocol === "https:" && (parsed.username !== "" || parsed.password !== "")) {
      return null;
    }
    if (parsed.protocol === "ssh:" && parsed.username !== "" && parsed.username !== "git") {
      return null;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "ssh:") return null;
    const repository = repositoryFromPath(parsed.pathname);
    return repository ? { repository } : null;
  } catch {
    return null;
  }
}

function disconnected(): GitHubConnectionContract {
  return {
    status: "disconnected",
    login: null,
    error_code: "github_auth_required",
    error_message: "Sign in to GitHub to continue.",
  };
}

function authStatusFailed(): GitHubConnectionContract {
  return {
    status: "failed",
    login: null,
    error_code: "github_auth_status_failed",
    error_message: "GitHub authentication status could not be read.",
  };
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

function parseAuthStatus(stdout: string): GitHubConnectionContract {
  try {
    const parsed = authStatusSchema.parse(JSON.parse(stdout));
    const account = parsed.hosts["github.com"]?.find(
      (candidate) => candidate.active && candidate.state === "success",
    );
    return account
      ? { status: "connected", login: account.login, error_code: null, error_message: null }
      : disconnected();
  } catch {
    throw new GitHubCliError("github_auth_response_invalid", "GitHub auth response was invalid.");
  }
}

function selectRemote(candidates: GitHubRemote[]): GitHubRemote {
  const origin = candidates.find((candidate) => candidate.name === "origin");
  if (origin) return origin;
  const [onlyCandidate] = candidates;
  if (onlyCandidate && candidates.length === 1) return onlyCandidate;
  if (!onlyCandidate) {
    throw new GitHubCliError(
      "github_remote_missing",
      "No usable GitHub remote was found for this run.",
    );
  }
  throw new GitHubCliError(
    "github_remote_ambiguous",
    "More than one GitHub remote is available; configure origin explicitly.",
  );
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
