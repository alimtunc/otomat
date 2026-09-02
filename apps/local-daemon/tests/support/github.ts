import { getPullRequestForRun, type Db, type PullRequestRow, type RunRow } from "@otomat/db";
import type {
  GitHubConnectionContract,
  PublishPullRequestRequest,
  PullRequestInbox,
  PullRequestPublicationMode,
  PullRequestPublishability,
} from "@otomat/domain";

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
  type PullRequestSearchInput,
  type PullRequestSelector,
  type PullRequestUpdateInput,
  type PullRequestMergeInput,
  type PullRequestOverviewFacts,
  type PullRequestViewedFile,
  type PullRequestViewedFiles,
  type RepositoryMergePolicy,
  type ReviewSubmissionInput,
  type ViewedFileMutationInput,
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

export const PUBLISHABLE_WORKSPACE: PullRequestPublishability = {
  blocker: null,
  repository: "acme/otomat",
  base_ref: "main",
  head_ref: "otomat/run/run-detail",
  changed_files: 1,
  additions: 1,
  deletions: 0,
  dirty: false,
};

export function publishRequest(
  summary: string,
  overrides: Partial<PublishPullRequestRequest["details"]> = {},
  mode: PullRequestPublicationMode = "ready",
): PublishPullRequestRequest {
  return {
    mode,
    details: { subject: { type: "feat", scope: null, summary }, body: "Details", ...overrides },
  };
}

/** Publication is accepted, then worked on; a test asserting its outcome waits for the daemon to finish it. */
export async function publishAndSettle(
  github: GitHubService,
  db: Db,
  run: RunRow,
  request: PublishPullRequestRequest,
): Promise<PullRequestRow> {
  await github.publish(run, request);
  await github.settlePublications();
  const row = getPullRequestForRun(db, run.id);
  if (!row) throw new Error(`no pull request was recorded for run ${run.id}`);
  return row;
}

/** What GitHub answers about a pull request, review facts included, so every fake speaks one shape. */
export function providerPullRequest(overrides: Partial<GitHubPullRequest> = {}): GitHubPullRequest {
  return {
    nodeId: "PR_node_42",
    number: 42,
    url: "https://github.com/acme/otomat/pull/42",
    title: "feat: ship it",
    body: "Details",
    headRef: "",
    headSha: "0".repeat(40),
    baseRef: "main",
    lifecycle: "open",
    authorLogin: "octocat",
    reviewDecision: null,
    checksState: "none",
    mergeable: "unknown",
    requestedReviewers: [],
    updatedAt: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

export function pullRequestRow(overrides: Partial<PullRequestRow> = {}): PullRequestRow {
  return {
    id: "pr1",
    issue_id: "issue-detail",
    run_id: "run-detail",
    repository_id: null,
    provider: "github",
    origin: "otomat",
    provenance: "otomat",
    author_login: null,
    review_decision: null,
    checks_state: "none",
    mergeable: "unknown",
    requested_reviewers: [],
    provider_updated_at: null,
    synced_at: null,
    number: null,
    node_id: null,
    url: null,
    status: "draft",
    publication_status: "not_configured",
    failed_phase: null,
    title: "First slice",
    body: null,
    head_ref: null,
    base_ref: null,
    head_sha: null,
    base_sha: null,
    commit_subject: null,
    commit_body: null,
    generator_runtime: null,
    generator_model: null,
    generator_effort: null,
    published_head_sha: null,
    published_diff_sha: null,
    attached_at: null,
    attached_by: null,
    attachment_evidence: null,
    detached_at: null,
    error_code: null,
    error_message: null,
    created_at: "2026-07-05T00:00:00.000Z",
    updated_at: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

export const EMPTY_PULL_REQUEST_INBOX: PullRequestInbox = {
  project_id: "p1",
  viewer: { login: null, teams_known: false },
  sync: { running: false, repositories: 0, last_synced_at: null, last_error: null },
  entries: [],
};

export function stubGitHubService(overrides: Partial<GitHubService> = {}): GitHubService {
  return {
    connection: async () => DISCONNECTED_GITHUB,
    pullRequestInbox: () => EMPTY_PULL_REQUEST_INBOX,
    syncPullRequestInbox: async () => EMPTY_PULL_REQUEST_INBOX,
    connect: () => ({
      status: "connecting",
      login: null,
      device_authorization: null,
      error_code: null,
      error_message: null,
    }),
    refreshTrackedPullRequests: async () => 0,
    listIssuePullRequests: async () => ({
      attached: [],
      candidates: [],
      detection: { status: "unavailable", message: "GitHub is not configured in this test." },
    }),
    attachPullRequest: async () => {
      throw new Error("attachPullRequest stub not configured");
    },
    detachPullRequest: () => {
      throw new Error("detachPullRequest stub not configured");
    },
    pullRequestIssue: () => null,
    refreshPullRequest: async () => {
      throw new Error("refreshPullRequest stub not configured");
    },
    getPullRequest: async () => null,
    publishability: async () => PUBLISHABLE_WORKSPACE,
    publish: async () => {
      throw new Error("publish stub not configured");
    },
    reconcileInterruptedPublications: () => 0,
    settlePublications: async () => {},
    pushCommits: async () => {
      throw new Error("pushCommits stub not configured");
    },
    generatePullRequestMetadata: async () => {
      throw new Error("generation stub not configured");
    },
    submitPullRequestReview: async () => {
      throw new Error("submitPullRequestReview stub not configured");
    },
    pullRequestOverview: async () => {
      throw new Error("pullRequestOverview stub not configured");
    },
    mergePullRequest: async () => {
      throw new Error("mergePullRequest stub not configured");
    },
    readViewedFiles: async () => {
      throw new Error("readViewedFiles stub not configured");
    },
    syncViewedFile: async () => {
      throw new Error("syncViewedFile stub not configured");
    },
    ...overrides,
  };
}

/** Remote heads are real worktree shas, so divergence and lease behaviour are exercised against git. */
export class FakeGitHubCli implements GitHubCli {
  connectionValue: GitHubConnectionContract = CONNECTED_GITHUB;
  remote: GitHubRemote = { name: "origin", repository: "acme/otomat" };
  provider: GitHubPullRequest = providerPullRequest();
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
  resolveRemoteCwds: string[] = [];
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

  async resolveRemote(cwd: string): Promise<GitHubRemote> {
    this.resolveRemoteCwds.push(cwd);
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

  searchResults: GitHubPullRequest[] = [];
  searchInputs: PullRequestSearchInput[] = [];

  async searchPullRequests(input: PullRequestSearchInput): Promise<GitHubPullRequest[]> {
    this.searchInputs.push(input);
    return this.searchResults;
  }

  openPullRequests: GitHubPullRequest[] = [];
  listError: Error | null = null;
  teams: string[] | null = [];

  async listOpenPullRequests(): Promise<GitHubPullRequest[]> {
    if (this.listError) throw this.listError;
    return this.openPullRequests;
  }

  async viewerTeams(): Promise<string[] | null> {
    return this.teams;
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

  submittedReviews: ReviewSubmissionInput[] = [];
  reviewSubmissionError: Error | null = null;

  async submitReview(input: ReviewSubmissionInput): Promise<{ url: string }> {
    this.submittedReviews.push(input);
    if (this.reviewSubmissionError) throw this.reviewSubmissionError;
    return { url: `https://github.com/acme/app/pull/${input.number}#pullrequestreview-1` };
  }

  overviewFacts: PullRequestOverviewFacts | null = null;

  async viewPullRequestOverview(): Promise<PullRequestOverviewFacts> {
    if (this.viewError) throw this.viewError;
    return (
      this.overviewFacts ?? {
        pullRequest: this.provider,
        checks: [],
        reviews: [],
        commits: 1,
        changedFiles: 1,
        additions: 1,
        deletions: 0,
        mergeState: "CLEAN",
      }
    );
  }

  mergePolicy: RepositoryMergePolicy = { methods: ["merge", "squash"], canPush: true };
  mergePolicyError: Error | null = null;

  async readRepositoryMergePolicy(): Promise<RepositoryMergePolicy> {
    if (this.mergePolicyError) throw this.mergePolicyError;
    return this.mergePolicy;
  }

  merges: PullRequestMergeInput[] = [];
  mergeError: Error | null = null;

  async mergePullRequest(input: PullRequestMergeInput): Promise<void> {
    this.merges.push(input);
    if (this.mergeError) throw this.mergeError;
    this.provider = { ...this.provider, lifecycle: "merged" };
  }

  viewedFiles: PullRequestViewedFile[] = [];
  viewedFileInputs: ViewedFileMutationInput[] = [];
  viewedFilesError: Error | null = null;
  setFileViewedError: Error | null = null;

  async listViewedFiles(): Promise<PullRequestViewedFiles> {
    if (this.viewedFilesError) throw this.viewedFilesError;
    return { nodeId: this.provider.nodeId, files: this.viewedFiles };
  }

  async setFileViewed(input: ViewedFileMutationInput): Promise<void> {
    this.viewedFileInputs.push(input);
    if (this.setFileViewedError) throw this.setFileViewedError;
    this.viewedFiles = [
      ...this.viewedFiles.filter((file) => file.path !== input.path),
      { path: input.path, state: input.viewed ? "VIEWED" : "UNVIEWED" },
    ];
  }
}
