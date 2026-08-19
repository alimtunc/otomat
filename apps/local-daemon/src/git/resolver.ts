import { getProject, getRepository, getRun, listRepositories, type Db } from "@otomat/db";

import type { GitWorktreeService, GitWorktreeServiceConfig } from "./service-contract.js";
import { createGitWorktreeService } from "./service.js";

/** Ties a persisted repository id to the worktree service operating on its root. */
export interface RepositoryBinding {
  repositoryId: string;
  /** Main working tree the run's worktree forks from; the base-branch check runs here. */
  rootPath: string;
  defaultBranch: string;
  service: GitWorktreeService;
}

export interface RepositoryResolverConfig {
  db: Db;
  /** Directory that holds every repository's worktree working directories. */
  worktreesRoot: string;
  /** Overrides worktree id generation, primarily for deterministic tests. */
  idFactory?: () => string;
}

/**
 * The single owner of repository-id to root-path to worktree-service resolution.
 * Every call reads the rows and builds a fresh binding: registering or repairing
 * a repository moves a project's root, and any cached verdict or service would
 * go on forking from the old one.
 */
export interface RepositoryResolver {
  worktreesRoot: string;
  /** Returns null for null ids and for unknown repository rows. */
  forRepository(repositoryId: string | null): RepositoryBinding | null;
  /** Resolves the project's main repository, or null when it has none. */
  forProject(projectId: string): RepositoryBinding | null;
  /** Resolves the repository pinned on a run, or null when the run has none. */
  forRun(runId: string): RepositoryBinding | null;
}

export function createRepositoryResolver(config: RepositoryResolverConfig): RepositoryResolver {
  const { db, worktreesRoot } = config;

  function forRepository(repositoryId: string | null): RepositoryBinding | null {
    if (repositoryId === null) return null;
    const repository = getRepository(db, repositoryId);
    if (!repository) return null;
    const project = getProject(db, repository.project_id);
    if (!project) return null;

    const serviceConfig: GitWorktreeServiceConfig = {
      db,
      repositoryId,
      repoRoot: project.root_path,
      defaultBranch: repository.default_branch,
      worktreesRoot,
    };
    if (config.idFactory) serviceConfig.idFactory = config.idFactory;
    return {
      repositoryId,
      rootPath: project.root_path,
      defaultBranch: repository.default_branch,
      service: createGitWorktreeService(serviceConfig),
    };
  }

  return {
    worktreesRoot,
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
