import {
  healthResponseSchema,
  runtimeDescriptorSchema,
  runtimeModelCatalogSchema,
} from "@otomat/domain";

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
    /** Probes the installed provider binary daemon-side, so it is fetched per selected runtime, not with the runtime list. */
    async runtimeModels(runtimeId: string) {
      return runtimeModelCatalogSchema.parse(
        await getJson(config, `/api/runtimes/${encodeURIComponent(runtimeId)}/models`),
      );
    },
  };
}
