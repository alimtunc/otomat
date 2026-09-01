import { randomUUID } from "node:crypto";

import {
  deleteAgentProfile,
  getAgentProfile,
  insertAgentProfile,
  updateAgentProfile,
  type Db,
} from "@otomat/db";
import {
  AGENT_PROFILE_NAME_MAX_LENGTH,
  saveAgentProfileRequestSchema,
  type SaveAgentProfileRequest,
} from "@otomat/domain";
import { Hono, type Context } from "hono";

import { ProfileNotFoundError, validateProfileInput } from "#agents";

import { agentConfigErrorResponse } from "../agent-config-refusal.js";
import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";
import { readAgentProfile, readAgentProfiles } from "../reads.js";
import { refusalJson } from "../refusal.js";

const COPY_SUFFIX = " (copy)";

function profileColumns(request: SaveAgentProfileRequest, projectId: string | null) {
  return {
    name: request.name,
    project_id: projectId,
    runtime: request.runtime,
    options_json: request.options ?? {},
    model: request.model ?? null,
    guidance: request.guidance ?? null,
    skill_ids_json: request.skill_ids ?? [],
  };
}

function copyName(sourceName: string): string {
  return `${sourceName.slice(0, AGENT_PROFILE_NAME_MAX_LENGTH - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
}

/** Every AGENT_PROFILE_ERRORS emission carries the { error, message } shape agentProfileErrorSchema declares. */
function profileNotFound(c: Context, id: string) {
  return refusalJson(c, {
    status: 404,
    error: "profile_not_found",
    message: new ProfileNotFoundError(id).message,
  });
}

/** Read-back after a successful write; absence means the row vanished mid-request, a daemon fault. */
function savedProfile(db: Db, id: string) {
  const profile = readAgentProfile(db, id);
  if (!profile) throw new Error(`agent profile ${id} missing after write`);
  return profile;
}

function refuseInvalid(db: Db, request: SaveAgentProfileRequest, projectId: string | null) {
  try {
    validateProfileInput(db, {
      project_id: projectId,
      runtime: request.runtime,
      options: request.options ?? {},
      model: request.model ?? null,
      skill_ids: request.skill_ids ?? [],
    });
    return null;
  } catch (error) {
    const refusal = agentConfigErrorResponse(error);
    if (refusal) return refusal;
    throw error;
  }
}

/** Agent profile CRUD, mounted at `/api/agent-profiles`. Profiles are mutable; a launch freezes an immutable snapshot into the run plan. */
export function createAgentProfileRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readAgentProfiles(deps.db, c.req.query("project_id"))));

  routes.post("/", validateJson(saveAgentProfileRequestSchema), (c) => {
    const request = c.req.valid("json");
    const projectId = request.project_id ?? null;
    const refusal = refuseInvalid(deps.db, request, projectId);
    if (refusal) return refusalJson(c, refusal);
    const id = randomUUID();
    insertAgentProfile(deps.db, { id, ...profileColumns(request, projectId) });
    return c.json(savedProfile(deps.db, id), 201);
  });

  // The owning project is fixed at creation: moving one would invalidate the skills it activates.
  routes.patch("/:id", validateJson(saveAgentProfileRequestSchema), (c) => {
    const id = c.req.param("id");
    const existing = getAgentProfile(deps.db, id);
    if (!existing) return profileNotFound(c, id);
    const request = c.req.valid("json");
    const refusal = refuseInvalid(deps.db, request, existing.project_id);
    if (refusal) return refusalJson(c, refusal);
    updateAgentProfile(deps.db, id, profileColumns(request, existing.project_id));
    return c.json(savedProfile(deps.db, id));
  });

  routes.post("/:id/duplicate", (c) => {
    const sourceId = c.req.param("id");
    const source = getAgentProfile(deps.db, sourceId);
    if (!source) return profileNotFound(c, sourceId);
    const copyId = randomUUID();
    insertAgentProfile(deps.db, {
      id: copyId,
      name: copyName(source.name),
      project_id: source.project_id,
      runtime: source.runtime,
      options_json: source.options_json,
      model: source.model,
      guidance: source.guidance,
      skill_ids_json: source.skill_ids_json,
    });
    return c.json(savedProfile(deps.db, copyId), 201);
  });

  routes.delete("/:id", (c) => {
    const id = c.req.param("id");
    if (!getAgentProfile(deps.db, id)) return profileNotFound(c, id);
    deleteAgentProfile(deps.db, id);
    return c.body(null, 204);
  });

  return routes;
}
