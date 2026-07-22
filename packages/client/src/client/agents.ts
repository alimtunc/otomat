import {
  agentProfileContractSchema,
  skillContractSchema,
  type SaveAgentProfileRequest,
  type SetSkillEnabledRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { deleteJson, getJson, patchJson, postJson } from "./http.js";

export function createAgentsClient(config: DaemonClientConfig) {
  return {
    async listAgentProfiles() {
      return agentProfileContractSchema.array().parse(await getJson(config, "/api/agent-profiles"));
    },
    async createAgentProfile(request: SaveAgentProfileRequest) {
      return agentProfileContractSchema.parse(
        await postJson(config, "/api/agent-profiles", request),
      );
    },
    async updateAgentProfile(id: string, request: SaveAgentProfileRequest) {
      return agentProfileContractSchema.parse(
        await patchJson(config, `/api/agent-profiles/${encodeURIComponent(id)}`, request),
      );
    },
    async duplicateAgentProfile(id: string) {
      return agentProfileContractSchema.parse(
        await postJson(config, `/api/agent-profiles/${encodeURIComponent(id)}/duplicate`, {}),
      );
    },
    async deleteAgentProfile(id: string) {
      await deleteJson(config, `/api/agent-profiles/${encodeURIComponent(id)}`);
    },
    async listSkills() {
      return skillContractSchema.array().parse(await getJson(config, "/api/skills"));
    },
    async scanSkills() {
      return skillContractSchema.array().parse(await postJson(config, "/api/skills/scan", {}));
    },
    async setSkillEnabled(id: string, request: SetSkillEnabledRequest) {
      return skillContractSchema.parse(
        await patchJson(config, `/api/skills/${encodeURIComponent(id)}`, request),
      );
    },
  };
}
