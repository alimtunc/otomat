import {
  deleteRepositoryCascade,
  getProject,
  getRepository,
  repositoryHasActiveRuns,
  updateRepositoryInitCommands,
} from "@otomat/db";
import {
  registerRepositoryRequestSchema,
  updateRepositoryRequestSchema,
  type RepositoryFilesResponse,
  type RepositoryRegistrationError,
} from "@otomat/domain";
import { Hono } from "hono";

import { isRepositoryRoot, listBranches, searchTrackedFiles } from "#git";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";
import { readRepositories } from "../reads.js";
import { registerLocalRepository } from "../repository-registration.js";
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
  project_not_found: "This project no longer exists.",
  project_already_has_repository: "This project already has a repository.",
};

/** Enough for a picker to work against; a repository with more paths narrows by typing. */
const FILE_SEARCH_LIMIT = 50;

const CONFLICT_ERRORS: ReadonlySet<RepositoryRegistrationError> = new Set([
  "repository_already_registered",
  "project_already_has_repository",
]);

export function createRepositoryRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readRepositories(deps.db, c.req.query("projectId"))));

  routes.post("/", validateJson(registerRepositoryRequestSchema), (c) => {
    const { path, project_id } = c.req.valid("json");
    const result = registerLocalRepository(deps.db, path, project_id);
    if (!result.ok) {
      const status = CONFLICT_ERRORS.has(result.error) ? 409 : 400;
      return c.json({ error: result.error, message: REGISTRATION_MESSAGES[result.error] }, status);
    }
    return c.json(
      {
        project: toProject(result.project, true),
        repository: toRepository(result.repository, true),
      },
      201,
    );
  });

  routes.patch("/:id", validateJson(updateRepositoryRequestSchema), (c) => {
    const repository = getRepository(deps.db, c.req.param("id"));
    if (!repository) return c.json({ error: "repository_not_found" }, 404);
    updateRepositoryInitCommands(deps.db, repository.id, c.req.valid("json").init_commands);
    const updated = getRepository(deps.db, repository.id);
    if (!updated) return c.json({ error: "repository_not_found" }, 404);
    const project = getProject(deps.db, updated.project_id);
    return c.json(toRepository(updated, project ? isRepositoryRoot(project.root_path) : false));
  });

  /** Removes the repository, its runs, and the owning project; refused while a run is active. */
  routes.delete("/:id", (c) => {
    const repository = getRepository(deps.db, c.req.param("id"));
    if (!repository) {
      return c.json(
        { error: "repository_not_found", message: "This repository is no longer registered." },
        404,
      );
    }
    if (repositoryHasActiveRuns(deps.db, repository.id)) {
      return c.json(
        {
          error: "repository_has_active_runs",
          message: "Finish or abort this repository's active runs before deleting it.",
        },
        409,
      );
    }
    deleteRepositoryCascade(deps.db, repository.id);
    return c.body(null, 204);
  });

  /** Branches a run can fork from. 409 rather than an empty list so an unusable root is legible. */
  routes.get("/:id/branches", (c) => {
    const repository = getRepository(deps.db, c.req.param("id"));
    if (!repository) return c.json({ error: "repository_not_found" }, 404);
    const project = getProject(deps.db, repository.project_id);
    if (!project || !isRepositoryRoot(project.root_path)) {
      return c.json(
        {
          error: "repository_unavailable",
          message: "This repository's path is gone or is no longer a git repository.",
        },
        409,
      );
    }
    return c.json({
      default_branch: repository.default_branch,
      branches: listBranches(project.root_path),
    });
  });

  routes.get("/:id/files", (c) => {
    const repository = getRepository(deps.db, c.req.param("id"));
    if (!repository) return c.json({ error: "repository_not_found" }, 404);
    const project = getProject(deps.db, repository.project_id);
    if (!project || !isRepositoryRoot(project.root_path)) {
      return c.json(
        {
          error: "repository_unavailable",
          message: "This repository's path is gone or is no longer a git repository.",
        },
        409,
      );
    }
    const matches = searchTrackedFiles(
      project.root_path,
      c.req.query("q") ?? "",
      FILE_SEARCH_LIMIT,
    );
    return c.json(matches satisfies RepositoryFilesResponse);
  });

  return routes;
}
