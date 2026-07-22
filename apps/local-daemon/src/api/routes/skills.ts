import { getSkill, setSkillEnabled } from "@otomat/db";
import { setSkillEnabledRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import { rescanSkills } from "#agents";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";
import { readSkills } from "../reads.js";
import { toSkill } from "../serialize.js";

/** Local skills catalog, mounted at `/api/skills`: read the catalog, rescan known roots, toggle a skill's enablement. */
export function createSkillRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readSkills(deps.db)));

  // Explicit rescan of the known roots only (never a silent whole-home scan).
  routes.post("/scan", (c) => c.json(rescanSkills(deps.db).map(toSkill)));

  routes.patch("/:id", validateJson(setSkillEnabledRequestSchema), (c) => {
    const id = c.req.param("id");
    if (!getSkill(deps.db, id)) return c.json({ error: "skill_not_found" }, 404);
    setSkillEnabled(deps.db, id, c.req.valid("json").enabled);
    const skill = getSkill(deps.db, id);
    if (!skill) throw new Error(`skill ${id} missing after write`);
    return c.json(toSkill(skill));
  });

  return routes;
}
