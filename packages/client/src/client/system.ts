import {
  daemonLogExcerptSchema,
  healthResponseSchema,
  providerOptionSetSchema,
  runtimeDescriptorSchema,
  runtimeModelCatalogSchema,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, queryString } from "./http.js";

export function createSystemClient(config: DaemonClientConfig) {
  return {
    async health() {
      return healthResponseSchema.parse(await getJson(config, "/api/health"));
    },
    /** What the active host recorded for one failing request; already redacted on that host. */
    async daemonLogExcerpt(correlationId: string) {
      const path = `/api/diagnostics/logs${queryString({ correlation_id: correlationId })}`;
      return daemonLogExcerptSchema.parse(await getJson(config, path));
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
    /** The options the installed binary announces for this runtime and model; omitting the model asks for the provider default's set. */
    async runtimeProviderOptions(runtimeId: string, model?: string) {
      const path = `/api/runtimes/${encodeURIComponent(runtimeId)}/options${queryString({ model })}`;
      return providerOptionSetSchema.parse(await getJson(config, path));
    },
  };
}
