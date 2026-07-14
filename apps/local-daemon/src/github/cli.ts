import type { GitHubConnectionContract, PullRequestState } from "@otomat/domain";
import { z } from "zod";

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

export class GitHubCliError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GitHubCliError";
  }
}

const providerPullRequestSchema = z.object({
  id: z.string().min(1),
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

const PR_JSON_FIELDS = "id,number,url,title,body,headRefName,baseRefName,state,isDraft";

function failed(result: CommandResult, code: string, message: string): void {
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
    providerId: parsed.id,
    number: parsed.number,
    url: parsed.url,
    title: parsed.title,
    body: parsed.body,
    headRef: parsed.headRefName,
    baseRef: parsed.baseRefName,
    lifecycle: lifecycle(parsed.state, parsed.isDraft),
  };
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

export function createGitHubCli(run: CommandRunner): GitHubCli {
  async function connection(): Promise<GitHubConnectionContract> {
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

    const auth = await run({
      command: "gh",
      args: ["auth", "status", "--hostname", "github.com"],
      cwd: process.cwd(),
    });
    if (auth.exitCode !== 0 || auth.errorCode) return disconnected();

    const metadata = await run({
      command: "gh",
      args: ["auth", "status", "--hostname", "github.com", "--json", "hosts"],
      cwd: process.cwd(),
    });
    if (metadata.exitCode !== 0 || metadata.errorCode) return disconnected();
    try {
      const parsed = authStatusSchema.parse(JSON.parse(metadata.stdout));
      const account = parsed.hosts["github.com"]?.find(
        (candidate) => candidate.active && candidate.state === "success",
      );
      return account
        ? {
            status: "connected",
            login: account.login,
            error_code: null,
            error_message: null,
          }
        : disconnected();
    } catch {
      throw new GitHubCliError("github_auth_response_invalid", "GitHub auth response was invalid.");
    }
  }

  return {
    connection,
    async login() {
      const result = await run({
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
      failed(result, "github_login_failed", "GitHub login did not complete.");
      return connection();
    },
    async resolveRemote(cwd) {
      const names = await run({ command: "git", args: ["remote"], cwd });
      failed(names, "git_remote_list_failed", "Git remotes could not be read.");
      const candidates: GitHubRemote[] = [];
      for (const name of names.stdout
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean)) {
        const result = await run({
          command: "git",
          args: ["remote", "get-url", "--push", name],
          cwd,
        });
        if (result.exitCode !== 0 || result.errorCode) continue;
        const parsed = parseGitHubRemoteUrl(result.stdout.trim());
        if (parsed) candidates.push({ name, repository: parsed.repository });
      }
      const origin = candidates.find((candidate) => candidate.name === "origin");
      if (origin) return origin;
      if (candidates.length === 1) return candidates[0] as GitHubRemote;
      if (candidates.length === 0) {
        throw new GitHubCliError(
          "github_remote_missing",
          "No usable GitHub remote was found for this run.",
        );
      }
      throw new GitHubCliError(
        "github_remote_ambiguous",
        "More than one GitHub remote is available; configure origin explicitly.",
      );
    },
    async push(cwd, remote, branch) {
      const result = await run({
        command: "git",
        args: ["push", "--set-upstream", remote, `HEAD:refs/heads/${branch}`],
        cwd,
      });
      failed(result, "github_push_failed", "The run branch could not be pushed to GitHub.");
    },
    async findPullRequest(input: PullRequestSelector) {
      const result = await run({
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
      failed(result, "github_pr_lookup_failed", "GitHub pull requests could not be queried.");
      try {
        const rows = z.array(providerPullRequestSchema).parse(JSON.parse(result.stdout));
        return rows[0] ? toPullRequest(rows[0]) : null;
      } catch {
        throw new GitHubCliError(
          "github_pr_response_invalid",
          "GitHub returned invalid pull request metadata.",
        );
      }
    },
    async viewPullRequest(cwd, repository, number) {
      const result = await run({
        command: "gh",
        args: ["pr", "view", String(number), "--repo", repository, "--json", PR_JSON_FIELDS],
        cwd,
      });
      failed(result, "github_pr_lookup_failed", "The GitHub pull request could not be read.");
      try {
        return toPullRequest(JSON.parse(result.stdout));
      } catch {
        throw new GitHubCliError(
          "github_pr_response_invalid",
          "GitHub returned invalid pull request metadata.",
        );
      }
    },
    async createPullRequest(input: PullRequestCreateInput) {
      const result = await run({
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
      failed(result, "github_pr_create_failed", "GitHub could not create the pull request.");
    },
    async updatePullRequest(input: PullRequestUpdateInput) {
      const result = await run({
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
      failed(result, "github_pr_update_failed", "GitHub could not update the pull request.");
    },
  };
}
