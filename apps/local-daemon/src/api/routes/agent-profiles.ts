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

import { agentConfigErrorResponse, refusalJson } from "../agent-config-refusal.js";
import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";
import { readAgentProfile, readAgentProfiles } from "../reads.js";

const COPY_SUFFIX = " (copy)";

function profileColumns(request: SaveAgentProfileRequest) {
  return {
    name: request.name,
    runtime: request.runtime,
    options_json: request.options ?? {},
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

/** Validates the runtime, options and referenced skills; returns an honest refusal or null. */
function refuseInvalid(db: Db, request: SaveAgentProfileRequest) {
  try {
    validateProfileInput(db, {
      runtime: request.runtime,
      options: request.options ?? {},
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

  routes.get("/", (c) => c.json(readAgentProfiles(deps.db)));

  routes.post("/", validateJson(saveAgentProfileRequestSchema), (c) => {
    const request = c.req.valid("json");
    const refusal = refuseInvalid(deps.db, request);
    if (refusal) return refusalJson(c, refusal);
    const id = randomUUID();
    insertAgentProfile(deps.db, { id, ...profileColumns(request) });
    return c.json(savedProfile(deps.db, id), 201);
  });

  routes.patch("/:id", validateJson(saveAgentProfileRequestSchema), (c) => {
    const id = c.req.param("id");
    if (!getAgentProfile(deps.db, id)) return profileNotFound(c, id);
    const request = c.req.valid("json");
    const refusal = refuseInvalid(deps.db, request);
    if (refusal) return refusalJson(c, refusal);
    updateAgentProfile(deps.db, id, profileColumns(request));
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
      runtime: source.runtime,
      options_json: source.options_json,
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
