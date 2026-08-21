import type { UsageFacetOptions } from "@otomat/domain";
import { EmptyState, Icon, IconButton } from "@otomat/ui";
import { useUsageDashboard } from "@web/api/usage/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { CenteredState } from "@web/components/shell/centered-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { ActiveHostTag } from "@web/components/shell/remote-session/active-host-tag";
import { RouteShell } from "@web/components/shell/route-shell";
import { UsageActiveFilters } from "@web/components/usage/active-filters";
import { UsageBreakdown } from "@web/components/usage/breakdown";
import { UsageDailyChart } from "@web/components/usage/daily-chart";
import { UsageFiltersMenu } from "@web/components/usage/filters-menu";
import { UsageRunsTable } from "@web/components/usage/runs-table";
import { UsageSummary } from "@web/components/usage/summary";
import { useUsageView } from "@web/components/usage/use-usage-view";
import {
  toggleUsageRow,
  usageDayRows,
  usageEmitterRows,
  usageProjectRows,
  type UsageBreakdownRow,
} from "@web/lib/usage/breakdown";
import {
  activeUsageChips,
  activeUsageFilterCount,
  clearedUsageFilters,
  withoutUsageChip,
} from "@web/lib/usage/facets";

const NO_OPTIONS: UsageFacetOptions = { projects: [], emitters: [], issues: [] };

export function UsageView() {
  const view = useUsageView();
  const usage = useUsageDashboard(view.filters);
  const narrowed = activeUsageFilterCount(view.filters) > 0 || view.filters.period !== "all";
  const drillInto = (row: UsageBreakdownRow): void =>
    view.setFilters(toggleUsageRow(view.filters, row));

  return (
    <RouteShell
      active="usage"
      titleIcon="bar-chart"
      titleNote="What the providers reported for this host's runs — nothing is estimated."
      breadcrumbs={[{ label: "Usage", current: true }]}
      actions={
        <div className="flex items-center gap-2">
          <ActiveHostTag />
          <UsageFiltersMenu
            filters={view.filters}
            options={usage.data?.options ?? NO_OPTIONS}
            onChange={view.setFilters}
          />
          <IconButton
            label="Refresh usage"
            icon={<Icon name="refresh-cw" aria-hidden />}
            loading={usage.isFetching}
            onClick={() => void usage.refetch()}
          />
        </div>
      }
    >
      <QueryBoundary
        query={usage}
        pending={<ListSkeleton rows={4} height={52} />}
        error={
          <ErrorReport
            error={usage.error}
            context="Couldn’t load usage"
            onRetry={() => void usage.refetch()}
          />
        }
      >
        {(data) => (
          <>
            <UsageActiveFilters
              chips={activeUsageChips(view.filters, data.options)}
              onRemove={(chip) => view.setFilters(withoutUsageChip(view.filters, chip))}
              onClear={() => view.setFilters(clearedUsageFilters(view.filters))}
            />
            {data.totals.figures.turns === 0 ? (
              <CenteredState>
                <EmptyState
                  icon="bar-chart"
                  title={narrowed ? "No usage matches these filters" : "No usage recorded yet"}
                  description={
                    narrowed
                      ? "Widen the period or clear a filter to see the runs this host recorded."
                      : "Roll-ups appear here once a run's provider reports the tokens it used."
                  }
                />
              </CenteredState>
            ) : (
              <>
                <UsageSummary totals={data.totals} />
                <UsageDailyChart
                  rows={usageDayRows(data)}
                  filters={view.filters}
                  onSelect={drillInto}
                />
                <div className="flex flex-wrap divide-x divide-border-subtle border-b border-border-subtle">
                  <UsageBreakdown
                    title="By project"
                    rows={usageProjectRows(data)}
                    filters={view.filters}
                    emptyLabel="No project reported usage in this window."
                    onSelect={drillInto}
                  />
                  <UsageBreakdown
                    title="By runtime and model"
                    rows={usageEmitterRows(data)}
                    filters={view.filters}
                    emptyLabel="No runtime reported usage in this window."
                    onSelect={drillInto}
                  />
                </div>
                <UsageRunsTable rows={data.runs} total={data.totals.runs} />
              </>
            )}
          </>
        )}
      </QueryBoundary>
    </RouteShell>
  );
}
