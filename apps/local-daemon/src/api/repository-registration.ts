import { randomUUID } from "node:crypto";
import { basename } from "node:path";

import {
  getProject,
  getProjectByRootPath,
  getRepository,
  insertProject,
  insertRepository,
  listProjects,
  type Db,
  type ProjectRow,
  type RepositoryRow,
} from "@otomat/db";
import type { RepositoryRegistrationError } from "@otomat/domain";

import { probeLocalRepository, tryRealpath } from "#git";

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
 * Probes and deduplicates a local path, then creates its project and repository
 * rows atomically. Expected refusals are returned as typed errors.
 */
export function registerLocalRepository(db: Db, path: string): RegistrationResult {
  const probe = probeLocalRepository(path);
  if (!probe.ok) return probe;
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

  const projectRow = getProject(db, project.id);
  const repositoryRow = getRepository(db, repository.id);
  if (!projectRow || !repositoryRow) throw new Error("registered repository rows disappeared");
  return { ok: true, project: projectRow, repository: repositoryRow };
}
