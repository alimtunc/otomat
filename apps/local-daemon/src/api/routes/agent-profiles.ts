import { randomUUID } from "node:crypto";

import {
  deleteAgentProfile,
  getAgentProfile,
  insertAgentProfile,
  updateAgentProfile,
  type Db,
} from "@otomat/db";
import { saveAgentProfileRequestSchema, type SaveAgentProfileRequest } from "@otomat/domain";
import { Hono } from "hono";

import { agentConfigErrorResponse, validateProfileInput } from "#agents";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";
import { readAgentProfile, readAgentProfiles } from "../reads.js";

function profileColumns(request: SaveAgentProfileRequest) {
  return {
    name: request.name,
    runtime: request.runtime,
    options_json: request.options ?? {},
    guidance: request.guidance ?? null,
    skill_ids_json: request.skill_ids ?? [],
  };
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

  routes.get("/:id", (c) => {
    const profile = readAgentProfile(deps.db, c.req.param("id"));
    return profile ? c.json(profile) : c.json({ error: "profile_not_found" }, 404);
  });

  routes.post("/", validateJson(saveAgentProfileRequestSchema), (c) => {
    const request = c.req.valid("json");
    const refusal = refuseInvalid(deps.db, request);
    if (refusal) return c.json({ error: refusal.error, message: refusal.message }, refusal.status);
    const id = randomUUID();
    insertAgentProfile(deps.db, { id, ...profileColumns(request) });
    const profile = readAgentProfile(deps.db, id);
    return profile ? c.json(profile, 201) : c.json({ error: "internal_error" }, 500);
  });

  routes.patch("/:id", validateJson(saveAgentProfileRequestSchema), (c) => {
    const id = c.req.param("id");
    if (!getAgentProfile(deps.db, id)) return c.json({ error: "profile_not_found" }, 404);
    const request = c.req.valid("json");
    const refusal = refuseInvalid(deps.db, request);
    if (refusal) return c.json({ error: refusal.error, message: refusal.message }, refusal.status);
    updateAgentProfile(deps.db, id, profileColumns(request));
    const profile = readAgentProfile(deps.db, id);
    return profile ? c.json(profile) : c.json({ error: "internal_error" }, 500);
  });

  routes.post("/:id/duplicate", (c) => {
    const source = getAgentProfile(deps.db, c.req.param("id"));
    if (!source) return c.json({ error: "profile_not_found" }, 404);
    const id = randomUUID();
    insertAgentProfile(deps.db, {
      id,
      name: `${source.name} (copy)`,
      runtime: source.runtime,
      options_json: source.options_json,
      guidance: source.guidance,
      skill_ids_json: source.skill_ids_json,
    });
    const profile = readAgentProfile(deps.db, id);
    return profile ? c.json(profile, 201) : c.json({ error: "internal_error" }, 500);
  });

  routes.delete("/:id", (c) => {
    const id = c.req.param("id");
    if (!getAgentProfile(deps.db, id)) return c.json({ error: "profile_not_found" }, 404);
    deleteAgentProfile(deps.db, id);
    return c.body(null, 204);
  });

  return routes;
}
