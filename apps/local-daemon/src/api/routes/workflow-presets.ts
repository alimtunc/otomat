import { deleteWorkflowPreset, type Db } from "@otomat/db";
import {
  duplicateWorkflowPresetRequestSchema,
  saveWorkflowPresetRequestSchema,
} from "@otomat/domain";
import { Hono, type Context } from "hono";

import type { ApiDeps } from "../deps.js";
import { validateJson, workflowPresetGuard, type WorkflowPresetEnv } from "../guards.js";
import { readWorkflowPreset, readWorkflowPresets } from "../reads.js";
import { refusalJson } from "../refusal.js";
import {
  copyWorkflowPreset,
  saveWorkflowPreset,
  type WorkflowPresetWrite,
} from "../workflow-preset-writes.js";

/** Answers a write with the stored preset; absence means the row vanished mid-request, a daemon fault. */
function written(c: Context, db: Db, write: WorkflowPresetWrite, status: 200 | 201) {
  if (!write.ok) return refusalJson(c, write.refusal);
  const preset = readWorkflowPreset(db, write.id);
  if (!preset) throw new Error(`workflow preset ${write.id} missing after write`);
  return c.json(preset, status);
}

/**
 * Workflow preset CRUD, mounted at `/api/workflow-presets`. A preset is a reusable structure,
 * never a run: editing or deleting one leaves every launched plan exactly as it was frozen.
 */
export function createWorkflowPresetRoutes(deps: ApiDeps): Hono<WorkflowPresetEnv> {
  const routes = new Hono<WorkflowPresetEnv>();

  routes.get("/", (c) => c.json(readWorkflowPresets(deps.db, c.req.query("project_id"))));

  routes.post("/", validateJson(saveWorkflowPresetRequestSchema), (c) =>
    written(c, deps.db, saveWorkflowPreset(deps.db, c.req.valid("json"), null), 201),
  );

  routes.patch(
    "/:id",
    workflowPresetGuard(deps.db),
    validateJson(saveWorkflowPresetRequestSchema),
    (c) =>
      written(
        c,
        deps.db,
        saveWorkflowPreset(deps.db, c.req.valid("json"), c.get("preset").id),
        200,
      ),
  );

  routes.post(
    "/:id/duplicate",
    workflowPresetGuard(deps.db),
    validateJson(duplicateWorkflowPresetRequestSchema),
    (c) =>
      written(c, deps.db, copyWorkflowPreset(deps.db, c.get("preset"), c.req.valid("json")), 201),
  );

  routes.delete("/:id", workflowPresetGuard(deps.db), (c) => {
    deleteWorkflowPreset(deps.db, c.get("preset").id);
    return c.body(null, 204);
  });

  return routes;
}
