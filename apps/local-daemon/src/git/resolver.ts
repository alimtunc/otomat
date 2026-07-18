import { getProject, getRepository, getRun, listRepositories, type Db } from "@otomat/db";

import { createGitWorktreeService, type GitWorktreeService } from "./service.js";

/** Ties a `repositories.id` to the worktree service operating on its root. */
export interface RepositoryBinding {
  repositoryId: string;
  service: GitWorktreeService;
}

export interface RepositoryResolverConfig {
  db: Db;
  /** Directory that holds every repository's worktree working dirs. */
  worktreesRoot: string;
  /** Override `worktrees.id` generation (tests). */
  idFactory?: () => string;
}

/**
 * The single owner of `repository_id → root path → GitWorktreeService`
 * resolution. Services are cached per repository id; registrations are
 * insert-only, so a cached binding never goes stale within one process.
 */
export interface RepositoryResolver {
  /** Binding for a repository id; null for null ids and unknown repository/project rows. */
  forRepository(repositoryId: string | null): RepositoryBinding | null;
  /** The project's main repository (V1: its only one), or null when the project has none. */
  forProject(projectId: string): RepositoryBinding | null;
  /** The binding a run's git operations must use, from `runs.repository_id`; null when the run has no repository. */
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
