import type {
  GitHubConnectionContract,
  PullRequestCheck,
  PullRequestMergeMethod,
  PullRequestReviewEvent,
  PullRequestState,
  PullRequestSubmittedReview,
} from "@otomat/domain";

import type { PullRequestReviewFacts } from "../pull-request-facts.js";
import type { PullRequestViewedFiles } from "../viewed-state.js";

export interface GitHubRemote {
  name: string;
  repository: string;
}

export interface GitHubPullRequest extends PullRequestReviewFacts {
  nodeId: string;
  number: number;
  url: string;
  title: string;
  body: string | null;
  headRef: string;
  headSha: string;
  baseRef: string;
  lifecycle: PullRequestState;
  /** Null when GitHub no longer names an author, which is what keeps a provenance honestly `unknown`. */
  authorLogin: string | null;
}

export interface GitHubRepositoryTarget {
  cwd: string;
  repository: string;
}

export interface PullRequestTarget extends GitHubRepositoryTarget {
  number: number;
}

export interface PullRequestSelector extends GitHubRepositoryTarget {
  head: string;
  base: string;
}

export interface PullRequestListInput extends GitHubRepositoryTarget {
  limit: number;
}

export interface PullRequestSearchInput extends GitHubRepositoryTarget {
  /** The issue identifier alone; the lookup writes the search syntax, never a guess at the branch. */
  identifier: string;
  limit: number;
}

export interface PullRequestCreateInput extends PullRequestSelector {
  title: string;
  body: string;
  /** Creates the pull request as a draft; `false` opens it ready for review. */
  draft: boolean;
}

export interface PullRequestUpdateInput extends PullRequestTarget {
  title: string;
  body: string;
}

export interface PullRequestModeInput extends PullRequestTarget {
  /** True converts an open pull request back to a draft; false marks a draft ready for review. */
  draft: boolean;
}

/** GitHub's own naming for the two sides of a pull-request diff. */
export type ReviewCommentSide = "LEFT" | "RIGHT";

/** One entry of a review's `comments` array, in GitHub's own snake-cased shape. */
export interface ReviewSubmissionComment {
  path: string;
  body: string;
  side: ReviewCommentSide;
  line: number;
  /** First line of a multi-line anchor; absent comments on `line` alone. */
  start_line?: number;
  start_side?: ReviewCommentSide;
}

export interface ReviewSubmissionInput extends PullRequestTarget {
  /** The commit the whole review anchors to; GitHub rejects a sha its diff does not carry. */
  commitSha: string;
  body: string;
  event: PullRequestReviewEvent;
  comments: ReviewSubmissionComment[];
}

export interface PullRequestOverviewFacts {
  pullRequest: GitHubPullRequest;
  checks: PullRequestCheck[];
  reviews: PullRequestSubmittedReview[];
  commits: number;
  changedFiles: number;
  additions: number;
  deletions: number;
  /** GitHub's own merge-state verdict, uppercased; `BEHIND`, `DIRTY` and `BLOCKED` are the ones a merge reads. */
  mergeState: string;
}

export interface RepositoryMergePolicy {
  methods: PullRequestMergeMethod[];
  canPush: boolean;
}

export interface PullRequestMergeInput extends PullRequestTarget {
  method: PullRequestMergeMethod;
}

export interface ViewedFileMutationInput {
  cwd: string;
  pullRequestNodeId: string;
  path: string;
  viewed: boolean;
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
  /** Pull requests GitHub itself links to a query, newest first; the caller decides what the match proves. */
  searchPullRequests(input: PullRequestSearchInput): Promise<GitHubPullRequest[]>;
  listOpenPullRequests(input: PullRequestListInput): Promise<GitHubPullRequest[]>;
  viewerTeams(cwd: string): Promise<string[] | null>;
  viewPullRequest(cwd: string, repository: string, number: number): Promise<GitHubPullRequest>;
  createPullRequest(input: PullRequestCreateInput): Promise<void>;
  updatePullRequest(input: PullRequestUpdateInput): Promise<void>;
  /** Flips the draft flag of an existing pull request. Never merges and never touches branch protections. */
  setPullRequestMode(input: PullRequestModeInput): Promise<void>;
  /** GitHub's refusal reaches the reviewer verbatim. */
  submitReview(input: ReviewSubmissionInput): Promise<{ url: string }>;
  viewPullRequestOverview(input: PullRequestTarget): Promise<PullRequestOverviewFacts>;
  readRepositoryMergePolicy(input: GitHubRepositoryTarget): Promise<RepositoryMergePolicy>;
  /** Merges on GitHub itself. Never merges locally, never enables auto-merge, never touches branch protections. */
  mergePullRequest(input: PullRequestMergeInput): Promise<void>;
  listViewedFiles(input: PullRequestTarget): Promise<PullRequestViewedFiles>;
  setFileViewed(input: ViewedFileMutationInput): Promise<void>;
}
