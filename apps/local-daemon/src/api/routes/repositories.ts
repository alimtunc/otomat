import { registerRepositoryRequestSchema, type RepositoryRegistrationError } from "@otomat/domain";
import { Hono } from "hono";

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
};

/** Repository reads plus the local-path registration mutation, mounted at `/api/repositories`. */
export function createRepositoryRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readRepositories(deps.db, c.req.query("projectId"))));

  routes.post("/", validateJson(registerRepositoryRequestSchema), (c) => {
    const result = registerLocalRepository(deps.db, c.req.valid("json").path);
    if (!result.ok) {
      const status = result.error === "repository_already_registered" ? 409 : 400;
      return c.json({ error: result.error, message: REGISTRATION_MESSAGES[result.error] }, status);
    }
    return c.json(
      { project: toProject(result.project), repository: toRepository(result.repository) },
      201,
    );
  });

  return routes;
}
