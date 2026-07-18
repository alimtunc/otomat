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
} from "@otomat/db";
import { registerRepositoryRequestSchema, type RepositoryRegistrationError } from "@otomat/domain";
import { Hono } from "hono";

import { probeLocalRepository, tryRealpath } from "#git";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";
import { readRepositories } from "../reads.js";
import { toProject, toRepository } from "../serialize.js";

const REGISTRATION_MESSAGES: Record<RepositoryRegistrationError, string> = {
  path_not_absolute: "Provide an absolute path to the repository.",
  path_not_found: "This path does not exist on this machine.",
  path_not_directory: "This path is not a directory.",
  path_not_git_repository: "This directory is not a git repository.",
  path_not_repository_root: "Point at the repository root (the directory that contains .git).",
  head_detached: "The repository's HEAD is detached; check out a branch first.",
  default_branch_undetectable:
    "Could not detect a default branch; make an initial commit on a branch first.",
  repository_already_registered: "This repository is already registered.",
};

/** Canonical dedup: exact row match first, then realpath of legacy (possibly symlinked) roots. */
function findRegisteredProject(db: Db, canonicalRoot: string): ProjectRow | undefined {
  const exact = getProjectByRootPath(db, canonicalRoot);
  if (exact) return exact;
  return listProjects(db).find((project) => tryRealpath(project.root_path) === canonicalRoot);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

/** Mounted at `/api/repositories`: the read list plus the local-path registration mutation. */
export function createRepositoryRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readRepositories(deps.db, c.req.query("projectId"))));

  routes.post("/", validateJson(registerRepositoryRequestSchema), (c) => {
    const probe = probeLocalRepository(c.req.valid("json").path);
    if (!probe.ok) {
      return c.json({ error: probe.error, message: REGISTRATION_MESSAGES[probe.error] }, 400);
    }
    if (findRegisteredProject(deps.db, probe.rootPath)) {
      return c.json(
        {
          error: "repository_already_registered",
          message: REGISTRATION_MESSAGES.repository_already_registered,
        },
        409,
      );
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
      deps.db.transaction(
        () => {
          insertProject(deps.db, project);
          insertRepository(deps.db, repository);
        },
        { behavior: "immediate" },
      );
    } catch (error) {
      // The root_path unique index closed a race with another registration: same refusal, no partial write.
      if (isUniqueViolation(error)) {
        return c.json(
          {
            error: "repository_already_registered",
            message: REGISTRATION_MESSAGES.repository_already_registered,
          },
          409,
        );
      }
      throw error;
    }

    const projectRow = getProject(deps.db, project.id);
    const repositoryRow = getRepository(deps.db, repository.id);
    if (!projectRow || !repositoryRow) {
      return c.json({ error: "internal_error" }, 500);
    }
    return c.json({ project: toProject(projectRow), repository: toRepository(repositoryRow) }, 201);
  });

  return routes;
}
