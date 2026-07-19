import { getProject, getRepository, getRun, listRepositories, type Db } from "@otomat/db";

import { createGitWorktreeService, type GitWorktreeService } from "./service.js";

/** Ties a persisted repository id to the worktree service operating on its root. */
export interface RepositoryBinding {
  repositoryId: string;
  service: GitWorktreeService;
}

export interface RepositoryResolverConfig {
  db: Db;
  /** Directory that holds every repository's worktree working directories. */
  worktreesRoot: string;
  /** Overrides worktree id generation, primarily for deterministic tests. */
  idFactory?: () => string;
  /** Projects rejected during boot probing must never receive a worktree service. */
  unavailableProjectIds?: ReadonlySet<string>;
}

/**
 * The single owner of repository-id to root-path to worktree-service resolution.
 * Bindings are cached because repository registrations are insert-only within a process.
 */
export interface RepositoryResolver {
  /** Returns null for null ids and for unknown or unavailable repository rows. */
  forRepository(repositoryId: string | null): RepositoryBinding | null;
  /** Resolves the project's main repository, or null when it has none. */
  forProject(projectId: string): RepositoryBinding | null;
  /** Resolves the repository pinned on a run, or null when the run has none. */
  forRun(runId: string): RepositoryBinding | null;
}

export function createRepositoryResolver(config: RepositoryResolverConfig): RepositoryResolver {
  const { db, worktreesRoot } = config;
  const cache = new Map<string, RepositoryBinding>();

  function forRepository(repositoryId: string | null): RepositoryBinding | null {
    if (repositoryId === null) return null;
    const cached = cache.get(repositoryId);
    if (cached) return cached;

    const repository = getRepository(db, repositoryId);
    if (!repository) return null;
    const project = getProject(db, repository.project_id);
    if (!project) return null;
    if (config.unavailableProjectIds?.has(project.id)) return null;

    const binding: RepositoryBinding = {
      repositoryId,
      service: createGitWorktreeService({
        db,
        repositoryId,
        repoRoot: project.root_path,
        defaultBranch: repository.default_branch,
        worktreesRoot,
        ...(config.idFactory ? { idFactory: config.idFactory } : {}),
      }),
    };
    cache.set(repositoryId, binding);
    return binding;
  }

  return {
    forRepository,
    forProject(projectId) {
      const [main] = listRepositories(db, { projectId });
      return main ? forRepository(main.id) : null;
    },
    forRun(runId) {
      const run = getRun(db, runId);
      return run ? forRepository(run.repository_id) : null;
    },
  };
}
