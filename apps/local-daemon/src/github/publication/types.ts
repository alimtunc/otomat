import type { PullRequestRow, RunRow } from "@otomat/db";
import type { PreparePullRequestRequest } from "@otomat/domain";

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

export interface PullRequestPublicationService {
  get(runId: string): PullRequestView | null;
  publish(run: RunRow, request: PreparePullRequestRequest): Promise<PullRequestView>;
}

export interface ExistingPullRequestResult {
  row: PullRequestRow;
  completedView: PullRequestView | null;
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
  worktrees: GitWorktreeService;
  worktree: WorktreeRecord;
  remote: GitHubRemote;
  request: PublicationRequest;
}
