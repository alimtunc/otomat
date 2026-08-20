import { getPullRequest, updatePullRequest, type PullRequestRow } from "@otomat/db";

import type { ViewedFilesResult, ViewedFileState } from "#review";

import { GitHubPublicationError } from "./errors.js";
import { pullRequestCwd } from "./pull-request-cwd.js";
import type { GitHubServiceConfig } from "./types.js";
import type { ViewerViewedState } from "./viewed-state.js";

/** `DISMISSED` is GitHub's "viewed, then changed": the file is not reviewed as it now reads. */
function isViewed(state: ViewerViewedState): boolean {
  return state === "VIEWED";
}

/** A pull request GitHub actually carries: a draft row with no number has no Viewed state. */
interface LivePullRequest {
  row: PullRequestRow;
  number: number;
}

/** The live connection, not the cached viewer row: a mark must be stamped with the account gh is answering as right now. */
async function connectedLogin(config: GitHubServiceConfig): Promise<string | null> {
  const connection = await config.cli.connection();
  return connection.status === "connected" ? connection.login : null;
}

function requireLivePullRequest(
  config: GitHubServiceConfig,
  pullRequestId: string,
): LivePullRequest {
  const row = getPullRequest(config.db, pullRequestId);
  if (!row || row.number === null) {
    throw new GitHubPublicationError(
      "pr_missing",
      "There is no pull request on GitHub to synchronize this file with.",
    );
  }
  return { row, number: row.number };
}

export async function readViewedFiles(
  config: GitHubServiceConfig,
  pullRequestId: string,
): Promise<ViewedFilesResult> {
  const { row, number } = requireLivePullRequest(config, pullRequestId);
  const cwd = pullRequestCwd(config, row);
  const snapshot = await config.cli.listViewedFiles({
    cwd,
    repository: (await config.cli.resolveRemote(cwd)).repository,
    number,
  });
  updatePullRequest(config.db, row.id, { node_id: snapshot.nodeId });
  return {
    viewerLogin: await connectedLogin(config),
    files: snapshot.files.map((file) => ({ path: file.path, viewed: isViewed(file.state) })),
  };
}

export async function syncViewedFile(
  config: GitHubServiceConfig,
  pullRequestId: string,
  input: ViewedFileState,
): Promise<string | null> {
  const { row } = requireLivePullRequest(config, pullRequestId);
  if (row.node_id === null) {
    throw new GitHubPublicationError(
      "pr_node_missing",
      "Otomat has not read this pull request from GitHub yet — refresh it once to synchronize Viewed.",
    );
  }
  await config.cli.setFileViewed({
    cwd: pullRequestCwd(config, row),
    pullRequestNodeId: row.node_id,
    path: input.path,
    viewed: input.viewed,
  });
  return connectedLogin(config);
}
