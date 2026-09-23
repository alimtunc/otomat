import {
  getSyncState,
  listLivePullRequestsForRepository,
  listRepositories,
  saveSyncState,
  writeGitHubViewer,
} from "@otomat/db";

import type { RepositoryBinding } from "#git";

import { resolveRepositoryRemote } from "../import/repository.js";
import type { PullRequestImportConfig } from "../import/service.js";
import { mirrorPullRequest } from "../import/store.js";

export const SYNC_SOURCE = "github";
export const SYNC_RESOURCE = "pull_requests";

/** A repository busier than this reconciles its most recently updated open pull requests. */
const OPEN_PULL_REQUEST_LIMIT = 100;

async function syncRepository(
  config: PullRequestImportConfig,
  binding: RepositoryBinding,
  connectedLogin: string | null,
  syncedAt: string,
): Promise<void> {
  const { remote } = await resolveRepositoryRemote(config, binding);
  const repositoryId = binding.repositoryId;
  const open = await config.cli.listOpenPullRequests({
    cwd: binding.rootPath,
    repository: remote.repository,
    limit: OPEN_PULL_REQUEST_LIMIT,
  });
  for (const provider of open) {
    await mirrorPullRequest(config, { repositoryId, provider, connectedLogin, syncedAt });
  }

  const listed = new Set(open.map((provider) => provider.number));
  for (const row of listLivePullRequestsForRepository(config.db, repositoryId)) {
    if (row.number === null || listed.has(row.number)) continue;
    // A row GitHub no longer lists as open was merged, closed or paged out; only its own page says which.
    const provider = await config.cli.viewPullRequest(
      binding.rootPath,
      remote.repository,
      row.number,
    );
    await mirrorPullRequest(config, { repositoryId, provider, connectedLogin, syncedAt });
  }

  const stored = getSyncState(config.db, SYNC_SOURCE, SYNC_RESOURCE, repositoryId);
  saveSyncState(config.db, {
    id: stored?.id ?? config.idFactory(),
    source: SYNC_SOURCE,
    resource: SYNC_RESOURCE,
    external_id: repositoryId,
    cursor: null,
    last_synced_at: syncedAt,
  });
}

async function syncViewer(config: PullRequestImportConfig, cwd: string): Promise<string | null> {
  const connection = await config.cli.connection();
  const login = connection.status === "connected" ? connection.login : null;
  writeGitHubViewer(config.db, {
    login,
    teams: login === null ? null : await config.cli.viewerTeams(cwd),
  });
  return login;
}

export async function syncProjectPullRequests(
  config: PullRequestImportConfig,
  projectId: string,
): Promise<void> {
  const bindings = listRepositories(config.db, { projectId }).flatMap(
    (repository) => config.repositories.forRepository(repository.id) ?? [],
  );
  const [first] = bindings;
  if (first === undefined) return;
  const connectedLogin = await syncViewer(config, first.rootPath);
  if (connectedLogin === null) return;
  const syncedAt = new Date().toISOString();
  for (const binding of bindings) {
    await syncRepository(config, binding, connectedLogin, syncedAt);
  }
}
