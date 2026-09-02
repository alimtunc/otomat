import type { Db, PullRequestRow, RunRow } from "@otomat/db";
import type {
  AttachPullRequestRequest,
  GitHubConnectionContract,
  LinearLifecycleSync,
  PublishPullRequestRequest,
  PullRequestCandidate,
  PullRequestDetection,
  PullRequestInbox,
  PullRequestIssueLink,
  PullRequestMergeAvailability,
  PullRequestMergeMethod,
  PullRequestProposal,
  PullRequestPublishability,
  PullRequestSync,
  PushPullRequestRequest,
} from "@otomat/domain";

import type { RepositoryResolver } from "#git";
import type { PullRequestReviewSubmission, ViewedFilesResult, ViewedFileState } from "#review";

import type { GitHubCli, PullRequestOverviewFacts } from "./cli/contract.js";
import type { GenerationAgent } from "./generation/agent.js";
import type { GenerationInput } from "./generation/input.js";

export interface PullRequestGenerator {
  generate(agent: GenerationAgent, input: GenerationInput): Promise<PullRequestProposal>;
}

export interface CommandRequest {
  command: string;
  args: string[];
  cwd: string;
  stdin?: string;
  /** Kills the child and resolves with `errorCode: "timed_out"` when it outlives this. */
  timeoutMs?: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  errorCode?: string;
}

export type CommandRunner = (request: CommandRequest) => Promise<CommandResult>;

export interface PullRequestView {
  row: PullRequestRow;
  sync: PullRequestSync | null;
}

/** What an issue can say about its pull requests: the adopted rows, what names it, and whether that search ran. */
export interface IssuePullRequestsResult {
  attached: PullRequestRow[];
  candidates: PullRequestCandidate[];
  detection: PullRequestDetection;
}

export interface GitHubServiceConfig {
  db: Db;
  dataDir: string;
  /** Per-run resolution ensures publication pushes from the run's own repository. */
  repositories: RepositoryResolver;
  cli: GitHubCli;
  /** Writes PR metadata with a provider CLI; absent disables the generation endpoint honestly. */
  generator?: PullRequestGenerator;
  /** Carried to merge closure; the GitHub service itself never calls it. */
  syncIssueLifecycle?: LinearLifecycleSync;
  /** Carried to review, which owns the reconciliation; the GitHub service never implements it. */
  importViewedFiles?: PullRequestViewedImport;
  idFactory?: () => string;
}

export type PullRequestViewedImport = (pullRequestId: string) => void;

export interface GitHubService {
  connection(): Promise<GitHubConnectionContract>;
  connect(): GitHubConnectionContract;
  pullRequestInbox(projectId: string): PullRequestInbox;
  syncPullRequestInbox(projectId: string): Promise<PullRequestInbox>;
  listIssuePullRequests(issueId: string): Promise<IssuePullRequestsResult>;
  attachPullRequest(issueId: string, request: AttachPullRequestRequest): Promise<PullRequestRow>;
  detachPullRequest(pullRequestId: string): PullRequestRow;
  /** Display context only: resolving an issue for a pull request attaches nothing and owns nothing. */
  pullRequestIssue(row: PullRequestRow): PullRequestIssueLink | null;
  refreshPullRequest(pullRequestId: string): Promise<PullRequestRow>;
  /** Noticing a merge must not depend on a pull request panel being open. */
  refreshTrackedPullRequests(): Promise<number>;
  /** Re-reads a live pull request from the provider, settling the run when it turns out merged. */
  getPullRequest(runId: string): Promise<PullRequestView | null>;
  publishability(runId: string): Promise<PullRequestPublishability>;
  /** Accepts the publication and answers its initial state; it never pushes to a pull request that already exists. */
  publish(run: RunRow, request: PublishPullRequestRequest): Promise<PullRequestView>;
  /** Stamps every publication a stopped process left mid-phase as interrupted; answers how many. */
  reconcileInterruptedPublications(): number;
  settlePublications(): Promise<void>;
  /** Never commits: only commits the workspace already holds are published. */
  pushCommits(runId: string, request: PushPullRequestRequest): Promise<PullRequestView>;
  /** Writes and persists a proposal; it pushes nothing, creates no branch and opens no pull request. */
  generatePullRequestMetadata(run: RunRow): Promise<PullRequestProposal>;
  submitPullRequestReview(
    pullRequestId: string,
    input: PullRequestReviewSubmission,
  ): Promise<{ url: string }>;
  pullRequestOverview(pullRequestId: string): Promise<PullRequestOverviewResult>;
  mergePullRequest(pullRequestId: string, method: PullRequestMergeMethod): Promise<PullRequestRow>;
  readViewedFiles(pullRequestId: string): Promise<ViewedFilesResult>;
  syncViewedFile(pullRequestId: string, input: ViewedFileState): Promise<string | null>;
}

export interface PullRequestOverviewResult {
  row: PullRequestRow;
  repository: string;
  cwd: string;
  facts: PullRequestOverviewFacts;
  behindBase: boolean;
  merge: PullRequestMergeAvailability;
}
