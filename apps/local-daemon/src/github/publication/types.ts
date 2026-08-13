import type { PullRequestRow, RunRow } from "@otomat/db";
import type { PreparePullRequestRequest, PushPullRequestRequest } from "@otomat/domain";

import type { GitWorktreeService, WorktreeRecord } from "#git";

import type {
  GitHubPullRequest,
  GitHubRemote,
  GitHubServiceConfig,
  PullRequestView,
} from "../types.js";

export type PublicationConfig = Omit<GitHubServiceConfig, "idFactory"> & {
  idFactory: () => string;
};

export interface PublicationWorkspace {
  worktrees: GitWorktreeService;
  worktree: WorktreeRecord;
  remote: GitHubRemote;
  /** The branch the run forked from is the only base its reviewed diff matches. */
  baseRef: string;
  defaultBranch: string;
}

export interface PullRequestPublicationService {
  /** Refreshes a live pull request from the provider before answering; see `PullRequestPublisher.get`. */
  get(runId: string): Promise<PullRequestView | null>;
  publish(run: RunRow, request: PreparePullRequestRequest): Promise<PullRequestView>;
  pushCommits(runId: string, request: PushPullRequestRequest): Promise<PullRequestView>;
}

export interface ExistingPullRequestResult {
  row: PullRequestRow;
  /** Nothing left to publish: GitHub settled the pull request, or already holds the requested details. */
  done: boolean;
  provider: GitHubPullRequest | null;
}

export interface ProviderResult {
  row: PullRequestRow;
  provider: GitHubPullRequest;
}

export interface PublicationRequest extends PreparePullRequestRequest {
  normalizedBody: string | null;
}

export interface PublicationContext {
  run: RunRow;
  workspace: PublicationWorkspace;
  request: PublicationRequest;
}
