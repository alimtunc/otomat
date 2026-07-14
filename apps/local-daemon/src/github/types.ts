import type { GitHubConnectionContract, PullRequestState } from "@otomat/domain";

export interface CommandRequest {
  command: string;
  args: string[];
  cwd: string;
  stdin?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  errorCode?: string;
}

export type CommandRunner = (request: CommandRequest) => Promise<CommandResult>;

export interface GitHubRemote {
  name: string;
  repository: string;
}

export interface GitHubPullRequest {
  providerId: string;
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
  login(): Promise<GitHubConnectionContract>;
  resolveRemote(cwd: string): Promise<GitHubRemote>;
  push(cwd: string, remote: string, branch: string): Promise<void>;
  findPullRequest(input: PullRequestSelector): Promise<GitHubPullRequest | null>;
  viewPullRequest(cwd: string, repository: string, number: number): Promise<GitHubPullRequest>;
  createPullRequest(input: PullRequestCreateInput): Promise<void>;
  updatePullRequest(input: PullRequestUpdateInput): Promise<void>;
}
