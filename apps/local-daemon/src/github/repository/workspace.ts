import type { RepositoryPullRequestInput, RepositoryPullRequestPreview } from "@otomat/domain";

import { computeCanonicalDiff, isRepositoryRoot, runGit, sourceControlSnapshot } from "#git";

import { GitHubPublicationError } from "../errors.js";
import type { GitHubServiceConfig } from "../types.js";

export async function repositoryPublicationWorkspace(
  config: GitHubServiceConfig,
  repositoryId: string,
  baseRef: string,
) {
  const binding = config.repositories.forRepository(repositoryId);
  if (binding === null || !isRepositoryRoot(binding.rootPath))
    throw new GitHubPublicationError(
      "workspace_unavailable",
      "The project checkout is unavailable.",
    );
  const cwd = binding.rootPath;
  if (
    baseRef.startsWith("-") ||
    runGit(["check-ref-format", `refs/heads/${baseRef}`], { cwd, allowFailure: true }).exitCode !==
      0
  )
    throw new GitHubPublicationError("branch_invalid", "Enter a valid target branch name.");
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

export function repositoryPublicationDiff(cwd: string, base: string, head: string) {
  const ancestor = runGit(["merge-base", base, head], { cwd }).stdout.trim();
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
  const remoteRef = runGit(
    ["rev-parse", "--verify", `refs/remotes/${remote.name}/${baseRef}^{commit}`],
    { cwd, allowFailure: true },
  );
  const localRef =
    remoteRef.exitCode === 0
      ? remoteRef
      : runGit(["rev-parse", "--verify", `refs/heads/${baseRef}^{commit}`], {
          cwd,
          allowFailure: true,
        });
  if (localRef.exitCode !== 0)
    throw new GitHubPublicationError(
      "base_unavailable",
      "Fetch the target branch before preparing the pull request.",
    );
  const diff = repositoryPublicationDiff(cwd, localRef.stdout.trim(), snapshot.head);
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
) {
  const workspace = await repositoryPublicationWorkspace(config, repositoryId, request.base_ref);
  const { cwd, remote, snapshot } = workspace;
  if (snapshot.response.revision !== request.revision)
    throw new GitHubPublicationError(
      "checkout_stale",
      "The checkout changed. Refresh before publishing.",
    );
  const connection = await config.cli.connection();
  if (connection.status !== "connected")
    throw new GitHubPublicationError(
      "github_auth_required",
      "Connect GitHub in Settings before creating a pull request.",
    );
  await config.cli.fetchBranch(cwd, remote.name, request.base_ref);
  const base = runGit(["rev-parse", "FETCH_HEAD"], { cwd }).stdout.trim();
  const diff = repositoryPublicationDiff(cwd, base, snapshot.head);
  if (diff.files.length === 0)
    throw new GitHubPublicationError(
      "diff_empty",
      "No committed changes to publish against this base. Commit your changes first.",
    );
  if (sourceControlSnapshot(cwd).response.revision !== request.revision)
    throw new GitHubPublicationError(
      "checkout_stale",
      "The checkout changed during preparation. Refresh before publishing.",
    );
  return { ...workspace, connection, diff };
}

export type RepositoryPublicationWorkspace = Awaited<
  ReturnType<typeof prepareRepositoryPublication>
>;
