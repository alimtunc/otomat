import type { GitHubConnectionContract, PullRequestState } from "@otomat/domain";
import { z } from "zod";

import { normalizePullRequestBody } from "./body.js";
import { GitHubCliError } from "./errors.js";
import type { GitHubPullRequest, GitHubRemote } from "./types.js";

export const providerPullRequestSchema = z.object({
  number: z.number().int().positive(),
  url: z.url(),
  title: z.string(),
  body: z.string().nullable(),
  headRefName: z.string().min(1),
  headRefOid: z.string().min(1),
  baseRefName: z.string().min(1),
  state: z.enum(["OPEN", "CLOSED", "MERGED"]),
  isDraft: z.boolean(),
  /** GitHub omits the object for a deleted account, which is exactly the unverifiable identity. */
  author: z.object({ login: z.string().min(1) }).nullish(),
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

export const PR_JSON_FIELDS =
  "number,url,title,body,headRefName,headRefOid,baseRefName,state,isDraft,author";

/** `gh auth status --json hosts` appeared in 2.63.0; older gh exits 1 on it. */
export const MINIMUM_GH_VERSION = "2.63.0";

export function outdatedGhVersion(stdout: string): string | null {
  const match = /gh version (\d+)\.(\d+)\.(\d+)/.exec(stdout);
  if (!match) return null;
  const found = [Number(match[1]), Number(match[2]), Number(match[3])];
  const required = MINIMUM_GH_VERSION.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const foundPart = found[index] ?? 0;
    const requiredPart = required[index] ?? 0;
    if (foundPart !== requiredPart) {
      return foundPart < requiredPart ? `${match[1]}.${match[2]}.${match[3]}` : null;
    }
  }
  return null;
}

function lifecycle(state: "OPEN" | "CLOSED" | "MERGED", draft: boolean): PullRequestState {
  if (state === "MERGED") return "merged";
  if (state === "CLOSED") return "closed";
  return draft ? "draft" : "open";
}

export function toPullRequest(value: unknown): GitHubPullRequest {
  const parsed = providerPullRequestSchema.parse(value);
  return {
    number: parsed.number,
    url: parsed.url,
    title: parsed.title,
    body: normalizePullRequestBody(parsed.body),
    headRef: parsed.headRefName,
    headSha: parsed.headRefOid,
    baseRef: parsed.baseRefName,
    lifecycle: lifecycle(parsed.state, parsed.isDraft),
    authorLogin: parsed.author?.login ?? null,
  };
}

export function parsePullRequestJson<T>(stdout: string, parse: (payload: unknown) => T): T {
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

export function connectionProblem(
  status: GitHubConnectionContract["status"],
  code: string,
  message: string,
): GitHubConnectionContract {
  return {
    status,
    login: null,
    device_authorization: null,
    error_code: code,
    error_message: message,
  };
}

function disconnected(): GitHubConnectionContract {
  return connectionProblem(
    "disconnected",
    "github_auth_required",
    "Sign in to GitHub to continue.",
  );
}

export function authStatusFailed(): GitHubConnectionContract {
  return connectionProblem(
    "failed",
    "github_auth_status_failed",
    "GitHub authentication status could not be read.",
  );
}

export function parseAuthStatus(stdout: string): GitHubConnectionContract {
  try {
    const parsed = authStatusSchema.parse(JSON.parse(stdout));
    const account = parsed.hosts["github.com"]?.find(
      (candidate) => candidate.active && candidate.state === "success",
    );
    return account
      ? {
          status: "connected",
          login: account.login,
          device_authorization: null,
          error_code: null,
          error_message: null,
        }
      : disconnected();
  } catch {
    throw new GitHubCliError("github_auth_response_invalid", "GitHub auth response was invalid.");
  }
}

export function selectRemote(candidates: GitHubRemote[]): GitHubRemote {
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

const createdCommentSchema = z.object({ html_url: z.string() });

export function parseReviewCommentUrl(stdout: string): string {
  try {
    return createdCommentSchema.parse(JSON.parse(stdout)).html_url;
  } catch (error) {
    throw new GitHubCliError(
      "github_review_comment_unreadable",
      `GitHub accepted the review comment but its answer could not be read: ${String(error)}`,
    );
  }
}
