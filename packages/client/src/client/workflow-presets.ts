import {
  workflowPresetContractSchema,
  type DuplicateWorkflowPresetRequest,
  type SaveWorkflowPresetRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { deleteJson, getJson, patchJson, postJson, queryString } from "./http.js";

function presetPath(id: string, suffix = ""): string {
  return `/api/workflow-presets/${encodeURIComponent(id)}${suffix}`;
}

export function createWorkflowPresetsClient(config: DaemonClientConfig) {
  return {
    /** Every global preset plus the named project's own; without a project, the global library alone. */
    async listWorkflowPresets(projectId?: string) {
      return workflowPresetContractSchema
        .array()
        .parse(
          await getJson(config, `/api/workflow-presets${queryString({ project_id: projectId })}`),
        );
    },
    async createWorkflowPreset(request: SaveWorkflowPresetRequest) {
      return workflowPresetContractSchema.parse(
        await postJson(config, "/api/workflow-presets", request),
      );
    },
    async updateWorkflowPreset(id: string, request: SaveWorkflowPresetRequest) {
      return workflowPresetContractSchema.parse(await patchJson(config, presetPath(id), request));
    },
    async duplicateWorkflowPreset(id: string, request: DuplicateWorkflowPresetRequest) {
      return workflowPresetContractSchema.parse(
        await postJson(config, presetPath(id, "/duplicate"), request),
      );
    },
    async deleteWorkflowPreset(id: string) {
      await deleteJson(config, presetPath(id));
    },
  };
}
