import { randomUUID } from "node:crypto";
import { basename } from "node:path";

import {
  getProject,
  getProjectByRootPath,
  getRepository,
  insertProject,
  insertRepository,
  listProjects,
  listRepositories,
  updateProjectRootPath,
  updateRepositoryDefaultBranch,
  type Db,
  type ProjectRow,
  type RepositoryRow,
} from "@otomat/db";
import type { RepositoryRegistrationError } from "@otomat/domain";

import { isRepositoryRoot, probeLocalRepository, tryRealpath, type RepositoryProbe } from "#git";

type RepositoryProbeOk = Extract<RepositoryProbe, { ok: true }>;

type RegistrationResult =
  | { ok: true; project: ProjectRow; repository: RepositoryRow }
  | { ok: false; error: RepositoryRegistrationError };

/** Canonical dedup: exact row match first, then realpath of legacy or symlinked roots. */
function findRegisteredProject(db: Db, canonicalRoot: string): ProjectRow | undefined {
  const exact = getProjectByRootPath(db, canonicalRoot);
  if (exact) return exact;
  return listProjects(db).find((project) => tryRealpath(project.root_path) === canonicalRoot);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

/**
 * Attaches a probed path to an existing repository-less project. The project's
 * root moves to the probed path because the worktree service forks from the
 * project root — this is what makes a project that was created without a usable
 * repository launchable without orphaning the issues already bound to it.
 */
function attachToProject(db: Db, projectId: string, probe: RepositoryProbeOk): RegistrationResult {
  const project = getProject(db, projectId);
  if (!project) return { ok: false, error: "project_not_found" };
  const [existing] = listRepositories(db, { projectId });
  // An existing repository whose root is gone is repaired, not duplicated —
  // otherwise the only fix the blocked launch offers could never be applied.
  if (existing && isRepositoryRoot(project.root_path)) {
    return { ok: false, error: "project_already_has_repository" };
  }
  const owner = findRegisteredProject(db, probe.rootPath);
  if (owner && owner.id !== projectId) {
    return { ok: false, error: "repository_already_registered" };
  }

  const repositoryId = existing?.id ?? randomUUID();
  db.transaction(
    () => {
      if (project.root_path !== probe.rootPath) {
        updateProjectRootPath(db, projectId, probe.rootPath);
      }
      if (existing) {
        updateRepositoryDefaultBranch(db, existing.id, probe.defaultBranch);
        return;
      }
      insertRepository(db, {
        id: repositoryId,
        project_id: projectId,
        name: basename(probe.rootPath),
        default_branch: probe.defaultBranch,
      });
    },
    { behavior: "immediate" },
  );
  return requireRows(db, projectId, repositoryId);
}

/**
 * Probes and deduplicates a local path, then creates its project and repository
 * rows atomically — or attaches it to `projectId` when one is given. Expected
 * refusals are returned as typed errors.
 */
export function registerLocalRepository(
  db: Db,
  path: string,
  projectId?: string,
): RegistrationResult {
  const probe = probeLocalRepository(path);
  if (!probe.ok) return probe;
  if (projectId) return attachToProject(db, projectId, probe);
  if (findRegisteredProject(db, probe.rootPath)) {
    return { ok: false, error: "repository_already_registered" };
  }

  const name = basename(probe.rootPath);
  const project = { id: randomUUID(), name, root_path: probe.rootPath };
  const repository = {
    id: randomUUID(),
    project_id: project.id,
    name,
    default_branch: probe.defaultBranch,
  };
  try {
    db.transaction(
      () => {
        insertProject(db, project);
        insertRepository(db, repository);
      },
      { behavior: "immediate" },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      // A concurrent registration won the unique-root race; the transaction wrote no partial row.
      return { ok: false, error: "repository_already_registered" };
    }
    throw error;
  }

  return requireRows(db, project.id, repository.id);
}

/** Re-reads both rows so callers always get the persisted values, timestamps included. */
function requireRows(db: Db, projectId: string, repositoryId: string): RegistrationResult {
  const projectRow = getProject(db, projectId);
  const repositoryRow = getRepository(db, repositoryId);
  if (!projectRow || !repositoryRow) throw new Error("registered repository rows disappeared");
  return { ok: true, project: projectRow, repository: repositoryRow };
}
