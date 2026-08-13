import type { PullRequestRow } from "@otomat/db";
import type { GitHubConnectionContract } from "@otomat/domain";

import { headSha } from "#git";
import {
  GitHubCliError,
  type ForcePushWithLeaseInput,
  type GitHubCli,
  type GitHubPullRequest,
  type GitHubRemote,
  type GitHubService,
  type PullRequestCreateInput,
  type PullRequestModeInput,
  type PullRequestSelector,
  type PullRequestUpdateInput,
} from "#github";

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
    getPullRequest: async () => null,
    publish: async () => {
      throw new Error("publish stub not configured");
    },
    pushCommits: async () => {
      throw new Error("pushCommits stub not configured");
    },
    draftPullRequest: async () => {
      throw new Error("draft stub not configured");
    },
    ...overrides,
  };
}

/** Remote heads are real worktree shas, so divergence and lease behaviour are exercised against git. */
export class FakeGitHubCli implements GitHubCli {
  connectionValue: GitHubConnectionContract = CONNECTED_GITHUB;
  remote: GitHubRemote = { name: "origin", repository: "acme/otomat" };
  provider: GitHubPullRequest = {
    number: 42,
    url: "https://github.com/acme/otomat/pull/42",
    title: "Ship it",
    body: "Details",
    headRef: "",
    baseRef: "main",
    lifecycle: "open",
  };
  createInput: PullRequestCreateInput | null = null;
  resolveError: GitHubCliError | null = null;
  pushError: GitHubCliError | null = null;
  createError: GitHubCliError | null = null;
  connectionError: Error | null = null;
  viewError: GitHubCliError | null = null;
  modeError: GitHubCliError | null = null;
  providerExists = false;
  baseExists = true;
  pushCalls = 0;
  createCalls = 0;
  updateCalls = 0;
  pushedBranches: string[] = [];
  forcePushes: ForcePushWithLeaseInput[] = [];
  modeInputs: PullRequestModeInput[] = [];
  remoteHeads = new Map<string, string>();
  protectedBranches = new Set<string>();

  async connection(): Promise<GitHubConnectionContract> {
    if (this.connectionError) throw this.connectionError;
    return this.connectionValue;
  }

  async availability(): Promise<GitHubConnectionContract | null> {
    return null;
  }

  async remoteBranchExists(): Promise<boolean> {
    return this.baseExists;
  }

  async remoteBranchProtected(_cwd: string, _repository: string, branch: string): Promise<boolean> {
    return this.protectedBranches.has(branch);
  }

  async loginWithToken(): Promise<GitHubConnectionContract> {
    this.connectionValue = CONNECTED_GITHUB;
    return this.connectionValue;
  }

  async resolveRemote(): Promise<GitHubRemote> {
    if (this.resolveError) throw this.resolveError;
    return this.remote;
  }

  async push(cwd: string, _remote: string, branch: string): Promise<void> {
    this.pushCalls += 1;
    this.pushedBranches.push(branch);
    if (this.pushError) throw this.pushError;
    this.remoteHeads.set(branch, headSha(cwd));
  }

  async forcePushWithLease(input: ForcePushWithLeaseInput): Promise<void> {
    this.forcePushes.push(input);
    this.remoteHeads.set(input.branch, headSha(input.cwd));
  }

  async remoteHead(_cwd: string, _remote: string, branch: string): Promise<string | null> {
    return this.remoteHeads.get(branch) ?? null;
  }

  async fetchBranch(): Promise<void> {}

  async findPullRequest(input: PullRequestSelector): Promise<GitHubPullRequest | null> {
    const matchesSelector =
      this.provider.headRef === input.head && this.provider.baseRef === input.base;
    return this.providerExists && matchesSelector ? this.provider : null;
  }

  async viewPullRequest(): Promise<GitHubPullRequest> {
    if (this.viewError) throw this.viewError;
    return this.provider;
  }

  async createPullRequest(input: PullRequestCreateInput): Promise<void> {
    this.createCalls += 1;
    this.createInput = input;
    if (this.createError) throw this.createError;
    this.provider = {
      ...this.provider,
      headRef: input.head,
      baseRef: input.base,
      lifecycle: input.draft ? "draft" : "open",
    };
    this.providerExists = true;
  }

  async updatePullRequest(input: PullRequestUpdateInput): Promise<void> {
    this.updateCalls += 1;
    this.provider = { ...this.provider, title: input.title, body: input.body || null };
  }

  async setPullRequestMode(input: PullRequestModeInput): Promise<void> {
    this.modeInputs.push(input);
    if (this.modeError) throw this.modeError;
    this.provider = { ...this.provider, lifecycle: input.draft ? "draft" : "open" };
  }
}
