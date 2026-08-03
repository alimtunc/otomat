import type { Db, PullRequestRow, RunRow } from "@otomat/db";
import type {
  GitHubConnectionContract,
  PreparePullRequestRequest,
  PullRequestDraft,
  PullRequestState,
} from "@otomat/domain";

import type { RepositoryResolver } from "#git";

import type { DeviceAuthorization } from "./device-flow.js";

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
  hasUnpublishedChanges: boolean | null;
}

export interface GitHubServiceConfig {
  db: Db;
  dataDir: string;
  /** Per-run resolution ensures publication pushes from the run's own repository. */
  repositories: RepositoryResolver;
  cli: GitHubCli;
  /** Drafts PR metadata with the run's own agent CLI; absent disables the draft endpoint honestly. */
  drafter?: PullRequestDrafter;
  deviceAuthorization?: DeviceAuthorization;
  idFactory?: () => string;
}

export interface GitHubService {
  connection(): Promise<GitHubConnectionContract>;
  connect(): GitHubConnectionContract;
  getPullRequest(runId: string): PullRequestView | null;
  publish(run: RunRow, request: PreparePullRequestRequest): Promise<PullRequestView>;
  draftPullRequest(run: RunRow): Promise<PullRequestDraft>;
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

export interface PullRequestSelector {
  cwd: string;
  repository: string;
  head: string;
  base: string;
}

export interface PullRequestCreateInput extends PullRequestSelector {
  title: string;
  body: string;
}

export interface PullRequestUpdateInput {
  cwd: string;
  repository: string;
  number: number;
  title: string;
  body: string;
}

export interface GitHubCli {
  connection(): Promise<GitHubConnectionContract>;
  /** Null when gh can run; otherwise the not_installed/cli_outdated/failed contract. */
  availability(): Promise<GitHubConnectionContract | null>;
  /** False only on a definite GitHub 404 — a failed create then reads as "base branch missing", never on a transport blip. */
  remoteBranchExists(cwd: string, repository: string, branch: string): Promise<boolean>;
  loginWithToken(token: string): Promise<GitHubConnectionContract>;
  resolveRemote(cwd: string): Promise<GitHubRemote>;
  push(cwd: string, remote: string, branch: string): Promise<void>;
  findPullRequest(input: PullRequestSelector): Promise<GitHubPullRequest | null>;
  viewPullRequest(cwd: string, repository: string, number: number): Promise<GitHubPullRequest>;
  createPullRequest(input: PullRequestCreateInput): Promise<void>;
  updatePullRequest(input: PullRequestUpdateInput): Promise<void>;
}
