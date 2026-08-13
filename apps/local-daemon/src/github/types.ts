import type { Db, PullRequestRow, RunRow } from "@otomat/db";
import type {
  GitHubConnectionContract,
  LinearLifecycleSync,
  PreparePullRequestRequest,
  PullRequestDraft,
  PullRequestState,
  PullRequestSync,
  PushPullRequestRequest,
} from "@otomat/domain";

import type { RepositoryResolver } from "#git";
import type { PullRequestCommentInput } from "#review";

export interface PullRequestDraftInput {
  /** Runtime id of the run's own agent; only CLIs with a non-interactive print mode can draft. */
  runtime: string;
  cwd: string;
  /** What the run set out to do — issue title and/or the launch prompt. */
  objective: string;
  /** One line per changed file, `path +a -d`. */
  diffStat: string[];
  /** Concatenated per-file patches; truncated to a fixed budget by the drafter. */
  patch: string;
}

export interface PullRequestDrafter {
  draft(input: PullRequestDraftInput): Promise<PullRequestDraft>;
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

export interface GitHubServiceConfig {
  db: Db;
  dataDir: string;
  /** Per-run resolution ensures publication pushes from the run's own repository. */
  repositories: RepositoryResolver;
  cli: GitHubCli;
  /** Drafts PR metadata with the run's own agent CLI; absent disables the draft endpoint honestly. */
  drafter?: PullRequestDrafter;
  /** Carried to merge closure; the GitHub service itself never calls it. */
  syncIssueLifecycle?: LinearLifecycleSync;
  idFactory?: () => string;
}

export interface GitHubService {
  connection(): Promise<GitHubConnectionContract>;
  connect(): GitHubConnectionContract;
  /** Re-reads a live pull request from the provider, settling the run when it turns out merged. */
  getPullRequest(runId: string): Promise<PullRequestView | null>;
  /** Never pushes to a pull request that already exists. */
  publish(run: RunRow, request: PreparePullRequestRequest): Promise<PullRequestView>;
  /** Never commits: only commits the workspace already holds are published. */
  pushCommits(runId: string, request: PushPullRequestRequest): Promise<PullRequestView>;
  draftPullRequest(run: RunRow): Promise<PullRequestDraft>;
  publishReviewComment(runId: string, input: PullRequestCommentInput): Promise<{ url: string }>;
}

export interface GitHubRemote {
  name: string;
  repository: string;
}

export interface GitHubPullRequest {
  number: number;
  url: string;
  title: string;
  body: string | null;
  headRef: string;
  baseRef: string;
  lifecycle: PullRequestState;
}

export interface GitHubRepositoryTarget {
  cwd: string;
  repository: string;
}

export interface PullRequestSelector extends GitHubRepositoryTarget {
  head: string;
  base: string;
}

export interface PullRequestCreateInput extends PullRequestSelector {
  title: string;
  body: string;
  /** Creates the pull request as a draft; `false` opens it ready for review. */
  draft: boolean;
}

export interface PullRequestUpdateInput {
  cwd: string;
  repository: string;
  number: number;
  title: string;
  body: string;
}

export interface PullRequestModeInput {
  cwd: string;
  repository: string;
  number: number;
  /** True converts an open pull request back to a draft; false marks a draft ready for review. */
  draft: boolean;
}

/** GitHub's own naming for the two sides of a pull-request diff. */
export type ReviewCommentSide = "LEFT" | "RIGHT";

export interface ReviewCommentCreateInput {
  cwd: string;
  repository: string;
  number: number;
  /** The commit the comment anchors to; GitHub rejects a sha its diff does not carry. */
  commitSha: string;
  path: string;
  body: string;
  side: ReviewCommentSide;
  line: number;
  /** First line of a multi-line anchor; absent comments on `line` alone. */
  startLine?: number;
  startSide?: ReviewCommentSide;
}

export interface ForcePushWithLeaseInput {
  cwd: string;
  remote: string;
  branch: string;
  expectedRemoteSha: string;
}

export interface GitHubCli {
  connection(): Promise<GitHubConnectionContract>;
  /** Null when gh can run; otherwise the not_installed/cli_outdated/failed contract. */
  availability(): Promise<GitHubConnectionContract | null>;
  /** False only on a definite GitHub 404 — a failed create then reads as "base branch missing", never on a transport blip. */
  remoteBranchExists(cwd: string, repository: string, branch: string): Promise<boolean>;
  /** True whenever GitHub does not plainly answer "unprotected": a rewrite may not proceed on a maybe. */
  remoteBranchProtected(cwd: string, repository: string, branch: string): Promise<boolean>;
  loginWithToken(token: string): Promise<GitHubConnectionContract>;
  resolveRemote(cwd: string): Promise<GitHubRemote>;
  /** Fast-forward push; a rejected non-fast-forward throws `github_push_rejected` rather than forcing. */
  push(cwd: string, remote: string, branch: string): Promise<void>;
  forcePushWithLease(input: ForcePushWithLeaseInput): Promise<void>;
  remoteHead(cwd: string, remote: string, branch: string): Promise<string | null>;
  fetchBranch(cwd: string, remote: string, branch: string): Promise<void>;
  findPullRequest(input: PullRequestSelector): Promise<GitHubPullRequest | null>;
  viewPullRequest(cwd: string, repository: string, number: number): Promise<GitHubPullRequest>;
  createPullRequest(input: PullRequestCreateInput): Promise<void>;
  updatePullRequest(input: PullRequestUpdateInput): Promise<void>;
  /** Flips the draft flag of an existing pull request. Never merges and never touches branch protections. */
  setPullRequestMode(input: PullRequestModeInput): Promise<void>;
  /** GitHub's refusal reaches the reviewer verbatim. */
  createReviewComment(input: ReviewCommentCreateInput): Promise<{ url: string }>;
}
