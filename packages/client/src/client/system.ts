import { healthResponseSchema, runtimeDescriptorSchema } from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson } from "./http.js";

export function createSystemClient(config: DaemonClientConfig) {
  return {
    async health() {
      return healthResponseSchema.parse(await getJson(config, "/api/health"));
    },
    async listRuntimes() {
      return runtimeDescriptorSchema.array().parse(await getJson(config, "/api/runtimes"));
    },
  };
}
