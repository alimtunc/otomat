import type { UsageTotals } from "@otomat/domain";
import { Icon, IconButton, Popover, PopoverContent, PopoverTrigger } from "@otomat/ui";
import { UsageMetricValue } from "@web/components/usage/metric-value";
import { formatCostUsd, formatExactTokenCount, formatTokenCount } from "@web/lib/run/usage";
import { formatDurationMs } from "@web/lib/usage/format";
import type { ReactNode } from "react";

function Tile({ label, note, children }: { label: ReactNode; note?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-32 flex-col gap-0.5 px-3.5 py-2.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="text-md">{children}</span>
      {note === undefined ? null : <span className="text-xs text-text-tertiary">{note}</span>}
    </div>
  );
}

export function UsageSummary({ totals }: { totals: UsageTotals }) {
  const { figures, duration } = totals;
  return (
    <>
      <div className="flex flex-wrap items-stretch divide-x divide-border-subtle border-b border-border-subtle">
        <Tile label="Input tokens">
          <UsageMetricValue
            metric={figures.input_tokens}
            turns={figures.turns}
            format={formatTokenCount}
            exact={formatExactTokenCount}
          />
        </Tile>
        <Tile label="Output tokens">
          <UsageMetricValue
            metric={figures.output_tokens}
            turns={figures.turns}
            format={formatTokenCount}
            exact={formatExactTokenCount}
          />
        </Tile>
        <Tile
          label={
            <span className="inline-flex items-center gap-1">
              Reported cost
              <Popover>
                <PopoverTrigger
                  render={
                    <IconButton
                      label="How usage is measured"
                      size="sm"
                      icon={<Icon name="info" aria-hidden />}
                    />
                  }
                />
                <PopoverContent className="w-72 text-xs">
                  What the providers reported for this host’s runs — nothing is estimated. Execution
                  time covers measured runs.
                </PopoverContent>
              </Popover>
            </span>
          }
        >
          <UsageMetricValue
            metric={figures.cost_usd}
            turns={figures.turns}
            format={formatCostUsd}
          />
        </Tile>
        <Tile
          label="Execution time"
          note={
            duration.unmeasured_runs === 0
              ? undefined
              : `${duration.unmeasured_runs} run(s) not measured`
          }
        >
          {duration.total_ms === null ? (
            <span aria-label="Not measured" className="text-xs text-text-tertiary">
              —
            </span>
          ) : (
            <span className="font-mono tabular-nums text-foreground">
              {formatDurationMs(duration.total_ms)}
            </span>
          )}
        </Tile>
        <Tile label="Runs" note={`${totals.steps} step(s)`}>
          <span className="font-mono tabular-nums text-foreground">{totals.runs}</span>
        </Tile>
        <Tile
          label="Turns reported"
          note={
            figures.unreadable_turns === 0
              ? undefined
              : `${figures.unreadable_turns} unreadable payload(s)`
          }
        >
          <span className="font-mono tabular-nums text-foreground">{figures.turns}</span>
        </Tile>
      </div>
      <p className="px-3.5 py-1.5 text-xs text-text-tertiary">
        — not reported or not measured · Partial figures cover only reporting turns.
      </p>
    </>
  );
}
