import {
  agentCapacitySchema,
  daemonLogExcerptSchema,
  executionDefaultsSchema,
  healthResponseSchema,
  providerOptionSetSchema,
  runtimeDescriptorSchema,
  runtimeModelCatalogSchema,
  type ExecutionDefaults,
  type UpdateAgentCapacityRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, putJson, queryString } from "./http.js";

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
    async agentCapacity() {
      return agentCapacitySchema.parse(await getJson(config, "/api/settings/capacity"));
    },
    async setAgentCapacity(request: UpdateAgentCapacityRequest) {
      return agentCapacitySchema.parse(await putJson(config, "/api/settings/capacity", request));
    },
    async executionDefaults() {
      return executionDefaultsSchema.parse(
        await getJson(config, "/api/settings/execution-defaults"),
      );
    },
    async setExecutionDefaults(defaults: ExecutionDefaults) {
      return executionDefaultsSchema.parse(
        await putJson(config, "/api/settings/execution-defaults", defaults),
      );
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
