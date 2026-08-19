import { listUsageRuns, listUsageTurns, type Db } from "@otomat/db";
import {
  usageDashboard,
  usageDashboardSchema,
  type UsageDashboard,
  type UsageFilters,
  type UsagePeriod,
} from "@otomat/domain";

const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90 } satisfies Record<
  Exclude<UsagePeriod, "all">,
  number
>;
const DAY_MS = 86_400_000;

const RUN_LIMIT = 100;

export function readUsageDashboard(db: Db, filters: UsageFilters): UsageDashboard {
  const now = Date.now();
  const range = {
    from:
      filters.period === "all"
        ? null
        : new Date(now - PERIOD_DAYS[filters.period] * DAY_MS).toISOString(),
    to: new Date(now).toISOString(),
  };
  return usageDashboardSchema.parse(
    usageDashboard({
      range,
      turns: listUsageTurns(db, range),
      runs: listUsageRuns(db, range),
      filters,
      runLimit: RUN_LIMIT,
    }),
  );
}
