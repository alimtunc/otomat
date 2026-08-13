import { GitHubPublicationError } from "../errors.js";
import type { PublicationConfig, PublicationWorkspace } from "./types.js";

/** The sole source of what a publication may write, so a run whose launch state is long past still resolves. */
export async function resolveWorkspace(
  config: PublicationConfig,
  runId: string,
): Promise<PublicationWorkspace> {
  const binding = config.repositories.forRun(runId);
  const worktree = binding?.service.get(runId);
  if (!binding || !worktree) {
    throw new GitHubPublicationError("worktree_missing", "The run has no active worktree.");
  }
  return {
    worktrees: binding.service,
    worktree,
    remote: await config.cli.resolveRemote(worktree.path),
    /** A worktree recorded before fork refs carries an empty base, never a missing one. */
    baseRef: worktree.baseRef || binding.defaultBranch,
    defaultBranch: binding.defaultBranch,
  };
}
