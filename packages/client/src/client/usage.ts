import { usageDashboardSchema, type UsageFilters } from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, queryString } from "./http.js";

export function createUsageClient(config: DaemonClientConfig) {
  return {
    async getUsageDashboard(filters: UsageFilters) {
      const query = queryString({
        period: filters.period,
        day: filters.day ?? undefined,
        projects: filters.projects,
        runtimes: filters.runtimes,
        models: filters.models,
        issues: filters.issues,
      });
      return usageDashboardSchema.parse(await getJson(config, `/api/usage${query}`));
    },
  };
}
