import {
  isUsageDay,
  NO_USAGE_FILTERS,
  USAGE_PERIODS,
  type UsageFilters,
  type UsagePeriod,
} from "@otomat/domain";
import { Hono, type HonoRequest } from "hono";

import type { ApiDeps } from "../deps.js";
import { readUsageDashboard } from "../usage-dashboard.js";

function period(raw: string | undefined): UsagePeriod {
  return USAGE_PERIODS.find((known) => known === raw) ?? NO_USAGE_FILTERS.period;
}

/** An unreadable axis falls back to its default instead of failing the read, one axis at a time. */
function usageFilters(req: HonoRequest): UsageFilters {
  const day = req.query("day");
  return {
    period: period(req.query("period")),
    day: day !== undefined && isUsageDay(day) ? day : null,
    projects: req.queries("projects") ?? [],
    runtimes: req.queries("runtimes") ?? [],
    models: req.queries("models") ?? [],
    issues: req.queries("issues") ?? [],
  };
}

export function createUsageRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readUsageDashboard(deps.db, usageFilters(c.req))));

  return routes;
}
