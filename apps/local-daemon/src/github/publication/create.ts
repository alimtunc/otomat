import type { PullRequestRow } from "@otomat/db";

import { GitHubPublicationError } from "../errors.js";
import { ensureProvider, providerPatch } from "./provider.js";
import type { PublicationStore } from "./store.js";
import type { PublicationConfig, PublicationContext } from "./types.js";

/** The one path that commits on the user's behalf, and the one they asked for by opening the pull request. */
export async function createPublication(
  config: PublicationConfig,
  store: PublicationStore,
  row: PullRequestRow,
  context: PublicationContext,
): Promise<PullRequestRow> {
  const { workspace, request } = context;
  if (workspace.worktrees.diff(context.run.id).files.length === 0) {
    throw new GitHubPublicationError("diff_empty", "The run has no changes to publish.");
  }
  const head = request.head_ref ?? row.head_ref ?? workspace.worktree.branch;
  row = store.transition(
    row,
    "pushing",
    {
      title: request.title,
      body: request.normalizedBody,
      head_ref: head,
      error_code: null,
      error_message: null,
    },
    "git",
  );

  const pushed = workspace.worktrees.snapshot(context.run.id).headSha;
  const selector = {
    cwd: workspace.worktree.path,
    repository: workspace.remote.repository,
    head,
    base: workspace.baseRef,
  };
  await config.cli.push(workspace.worktree.path, workspace.remote.name, head);

  const published = await ensureProvider(store, config.cli, row, selector, request);
  const reconciled = store.reconcileLifecycle(published.row, published.provider.lifecycle);
  return store.transition(
    reconciled,
    "created",
    {
      ...providerPatch(published.provider),
      published_head_sha: pushed,
      published_diff_sha: workspace.worktrees.commitDiff(context.run.id, pushed).sha,
    },
    "github",
    "pr.created",
  );
}
