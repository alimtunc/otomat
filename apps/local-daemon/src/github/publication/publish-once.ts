import type { PullRequestRow, RunRow } from "@otomat/db";
import type { GitHubConnectionContract } from "@otomat/domain";

import { createPublication } from "./create.js";
import { requestedDetails } from "./details.js";
import { providerPatch, refreshExistingPullRequest, updateDetails } from "./provider.js";
import type { PublicationStore } from "./store.js";
import type { PublicationConfig, PublicationRequest } from "./types.js";
import { resolveWorkspace } from "./workspace.js";

function persistConnectionState(
  store: PublicationStore,
  row: PullRequestRow,
  request: PublicationRequest,
  connection: GitHubConnectionContract,
): PullRequestRow {
  return store.transition(
    row,
    connection.status === "failed" ? "failed" : "not_configured",
    {
      ...requestedDetails(request),
      error_code: connection.error_code,
      error_message: connection.error_message,
    },
    "github",
  );
}

/** One publication against GitHub: open the pull request, or bring the one that exists to the requested details. */
export async function publishOnce(
  config: PublicationConfig,
  store: PublicationStore,
  run: RunRow,
  request: PublicationRequest,
): Promise<PullRequestRow> {
  let row = store.ensureRow(run, request.title, request.normalizedBody);
  if (row.status === "merged" || row.status === "closed") return row;
  // Publishability is a property of the workspace, so how the run ended is recorded, never enforced.
  if (row.number === null && run.status !== "review_ready") {
    store.recordExecutionOverride(row, run);
  }
  const workspace = await resolveWorkspace(config, run.id);
  const connection = await config.cli.connection();
  if (connection.status !== "connected") {
    return persistConnectionState(store, row, request, connection);
  }
  const context = { run, workspace, request };
  const existing = await refreshExistingPullRequest(store, config.cli, row, context);
  row = existing.row;
  if (existing.done) return row;
  if (existing.provider === null) {
    return createPublication(config, store, row, context);
  }
  // Refreshing lands on `created` to record that the pull request exists; the requested update has still to reach GitHub.
  row = store.transition(row, "creating", {}, "github");
  const provider = await updateDetails(
    config.cli,
    existing.provider,
    { cwd: workspace.worktree.path, repository: workspace.remote.repository },
    request,
  );
  const reconciled = store.reconcileLifecycle(row, provider.lifecycle);
  return store.transition(
    reconciled,
    "created",
    { ...requestedDetails(request), ...providerPatch(provider) },
    "github",
  );
}
