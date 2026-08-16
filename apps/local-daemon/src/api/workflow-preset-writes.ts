import { randomUUID } from "node:crypto";

import {
  findWorkflowPresetByName,
  getProject,
  insertWorkflowPreset,
  updateWorkflowPreset,
  type Db,
  type NewWorkflowPreset,
  type WorkflowPresetRow,
} from "@otomat/db";
import {
  WORKFLOW_PRESET_NAME_MAX_LENGTH,
  type DuplicateWorkflowPresetRequest,
  type SaveWorkflowPresetRequest,
  type WorkflowPresetError,
} from "@otomat/domain";

const COPY_SUFFIX = " (copy)";

export interface WorkflowPresetRefusal {
  status: 404 | 409;
  error: WorkflowPresetError;
  message: string;
}

export type WorkflowPresetWrite =
  | { ok: true; id: string }
  | { ok: false; refusal: WorkflowPresetRefusal };

/** The project a preset belongs to; null is the global library, shared by every project. */
function ownerProjectId(
  request: SaveWorkflowPresetRequest | DuplicateWorkflowPresetRequest,
): string | null {
  return request.scope === "project" ? request.project_id : null;
}

function refuseUnknownProject(db: Db, projectId: string | null): WorkflowPresetRefusal | null {
  if (projectId === null || getProject(db, projectId)) return null;
  return {
    status: 404,
    error: "preset_project_unknown",
    message: `project ${projectId} is not registered on this host`,
  };
}

function refuseTakenName(
  db: Db,
  name: string,
  projectId: string | null,
  allowedId: string | null,
): WorkflowPresetRefusal | null {
  const existing = findWorkflowPresetByName(db, { name, projectId });
  if (!existing || existing.id === allowedId) return null;
  const scope = projectId === null ? "the global library" : "this project";
  return {
    status: 409,
    error: "preset_name_taken",
    message: `a workflow preset named "${name}" already exists in ${scope}`,
  };
}

/** A copy always lands: the suffix is numbered until the target scope has room for it. */
function freeCopyName(db: Db, source: WorkflowPresetRow, projectId: string | null): string {
  for (let attempt = 1; ; attempt += 1) {
    const suffix = attempt === 1 ? COPY_SUFFIX : `${COPY_SUFFIX} ${attempt}`;
    const stem = source.name.slice(0, WORKFLOW_PRESET_NAME_MAX_LENGTH - suffix.length);
    const name = `${stem}${suffix}`;
    if (!findWorkflowPresetByName(db, { name, projectId })) return name;
  }
}

/** Stores a composition under `presetId`, or under a new id when the caller is creating one. */
export function saveWorkflowPreset(
  db: Db,
  request: SaveWorkflowPresetRequest,
  presetId: string | null,
): WorkflowPresetWrite {
  const projectId = ownerProjectId(request);
  const refusal =
    refuseUnknownProject(db, projectId) ?? refuseTakenName(db, request.name, projectId, presetId);
  if (refusal) return { ok: false, refusal };

  const columns: Omit<NewWorkflowPreset, "id"> = {
    name: request.name,
    scope: request.scope,
    project_id: projectId,
    plan_json: request.plan,
  };
  if (presetId !== null) {
    updateWorkflowPreset(db, presetId, columns);
    return { ok: true, id: presetId };
  }
  const id = randomUUID();
  insertWorkflowPreset(db, { id, ...columns });
  return { ok: true, id };
}

export function copyWorkflowPreset(
  db: Db,
  source: WorkflowPresetRow,
  request: DuplicateWorkflowPresetRequest,
): WorkflowPresetWrite {
  const projectId = ownerProjectId(request);
  const refusal = refuseUnknownProject(db, projectId);
  if (refusal) return { ok: false, refusal };

  const id = randomUUID();
  insertWorkflowPreset(db, {
    id,
    name: freeCopyName(db, source, projectId),
    scope: request.scope,
    project_id: projectId,
    plan_json: source.plan_json,
  });
  return { ok: true, id };
}
