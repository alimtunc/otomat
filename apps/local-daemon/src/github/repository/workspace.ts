import type {
  GitHubConnectionContract,
  RepositoryPullRequestInput,
  RepositoryPullRequestPreview,
} from "@otomat/domain";

import {
  computeCanonicalDiff,
  isRepositoryRoot,
  isValidBranchName,
  mergeBase,
  revParse,
  sourceControlSnapshot,
  switchToNewBranch,
  verifyRef,
  type CanonicalDiff,
  type CheckoutSnapshot,
} from "#git";

import type { GitHubRemote } from "../cli/contract.js";
import { GitHubPublicationError } from "../errors.js";
import type { GitHubServiceConfig } from "../types.js";

export interface RepositoryPublicationWorkspace {
  cwd: string;
  defaultBranch: string;
  snapshot: CheckoutSnapshot;
  remote: GitHubRemote;
}

export interface PreparedRepositoryPublication extends RepositoryPublicationWorkspace {
  connection: GitHubConnectionContract;
  diff: CanonicalDiff;
}

export function assertCheckoutRevision(
  snapshot: CheckoutSnapshot,
  revision: string,
  message: string,
): void {
  if (snapshot.response.revision !== revision)
    throw new GitHubPublicationError("checkout_stale", message);
}

function assertBranchName(cwd: string, branch: string, message: string): void {
  if (!isValidBranchName(cwd, branch)) throw new GitHubPublicationError("branch_invalid", message);
}

async function repositoryPublicationWorkspace(
  config: GitHubServiceConfig,
  repositoryId: string,
  baseRef: string,
): Promise<RepositoryPublicationWorkspace> {
  const binding = config.repositories.forRepository(repositoryId);
  if (binding === null || !isRepositoryRoot(binding.rootPath))
    throw new GitHubPublicationError(
      "workspace_unavailable",
      "The project checkout is unavailable.",
    );
  const cwd = binding.rootPath;
  assertBranchName(cwd, baseRef, "Enter a valid target branch name.");
  const snapshot = sourceControlSnapshot(cwd);
  if (snapshot.response.conflicts.length > 0)
    throw new GitHubPublicationError(
      "checkout_conflicted",
      "Resolve merge conflicts before publishing.",
    );
  if (snapshot.response.staged.length > 0)
    throw new GitHubPublicationError(
      "uncommitted_changes",
      "Commit the staged changes before creating a pull request.",
    );
  const remote = await config.cli.resolveRemote(cwd);
  return { cwd, defaultBranch: binding.defaultBranch, snapshot, remote };
}

function publicationDiff(cwd: string, base: string, head: string): CanonicalDiff {
  const ancestor = mergeBase(cwd, base, head);
  if (ancestor === null)
    throw new GitHubPublicationError(
      "base_unavailable",
      "The target branch shares no history with this checkout.",
    );
  return computeCanonicalDiff(cwd, ancestor, head);
}

export async function previewRepositoryPullRequest(
  config: GitHubServiceConfig,
  repositoryId: string,
  baseRef: string,
): Promise<RepositoryPullRequestPreview> {
  const { cwd, remote, snapshot } = await repositoryPublicationWorkspace(
    config,
    repositoryId,
    baseRef,
  );
  const base =
    verifyRef(cwd, `refs/remotes/${remote.name}/${baseRef}^{commit}`) ??
    verifyRef(cwd, `refs/heads/${baseRef}^{commit}`);
  if (base === null)
    throw new GitHubPublicationError(
      "base_unavailable",
      "Fetch the target branch before preparing the pull request.",
    );
  const diff = publicationDiff(cwd, base, snapshot.head);
  return {
    revision: snapshot.response.revision,
    publishability: {
      repository: remote.repository,
      base_ref: baseRef,
      head_ref: snapshot.response.branch,
      changed_files: diff.files.length,
      additions: diff.additions,
      deletions: diff.deletions,
      dirty: false,
      blocker:
        diff.files.length > 0
          ? null
          : {
              code: "diff_empty",
              message:
                "No committed changes to publish against this base. Commit your changes first.",
            },
    },
  };
}

export async function prepareRepositoryPublication(
  config: GitHubServiceConfig,
  repositoryId: string,
  request: RepositoryPullRequestInput,
): Promise<PreparedRepositoryPublication> {
  const workspace = await repositoryPublicationWorkspace(config, repositoryId, request.base_ref);
  const { cwd, remote, snapshot } = workspace;
  assertCheckoutRevision(
    snapshot,
    request.revision,
    "The checkout changed. Refresh before publishing.",
  );
  const connection = await config.cli.connection();
  if (connection.status !== "connected")
    throw new GitHubPublicationError(
      "github_auth_required",
      "Connect GitHub in Settings before creating a pull request.",
    );
  await config.cli.fetchBranch(cwd, remote.name, request.base_ref);
  const diff = publicationDiff(cwd, revParse(cwd, "FETCH_HEAD"), snapshot.head);
  if (diff.files.length === 0)
    throw new GitHubPublicationError(
      "diff_empty",
      "No committed changes to publish against this base. Commit your changes first.",
    );
  assertCheckoutRevision(
    sourceControlSnapshot(cwd),
    request.revision,
    "The checkout changed during preparation. Refresh before publishing.",
  );
  return { ...workspace, connection, diff };
}

export async function checkoutHeadBranch(
  config: GitHubServiceConfig,
  workspace: PreparedRepositoryPublication,
  request: RepositoryPullRequestInput,
  head: string,
): Promise<void> {
  const { cwd, remote, snapshot, defaultBranch } = workspace;
  assertBranchName(cwd, head, "Enter a valid Git branch name.");
  if ([request.base_ref, defaultBranch, "main", "master", "HEAD"].includes(head))
    throw new GitHubPublicationError(
      "branch_protected",
      "Choose a dedicated source branch before creating a pull request.",
    );
  const remoteHead = await config.cli.remoteHead(cwd, remote.name, head);
  if (head !== snapshot.response.branch && remoteHead !== null)
    throw new GitHubPublicationError(
      "branch_exists",
      "This remote branch already exists. Choose a new branch name.",
    );
  if (remoteHead !== null && (await config.cli.remoteBranchProtected(cwd, remote.repository, head)))
    throw new GitHubPublicationError("branch_protected", "Choose an unprotected source branch.");
  assertCheckoutRevision(
    sourceControlSnapshot(cwd),
    request.revision,
    "The checkout changed during preparation. Refresh before publishing.",
  );
  if (head === snapshot.response.branch) return;
  const failure = switchToNewBranch(cwd, head);
  if (failure !== null) throw new GitHubPublicationError("branch_unavailable", failure);
}
