import { Button, Icon, Popover, PopoverContent, PopoverTrigger, Switch } from "@otomat/ui";
import { CountBadge } from "@web/components/issues/count-badge";
import { DEFAULT_RUNS_VIEW_CONFIG, type RunsViewConfig } from "@web/lib/run/view-config";
import type { ReactNode } from "react";

export interface RunsToolbarProps {
  config: RunsViewConfig;
  hidden: { runs: number; groups: number };
  onChange: (patch: Partial<RunsViewConfig>) => void;
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-text-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}

function hiddenSummary(hidden: { runs: number; groups: number }): string | null {
  const parts: string[] = [];
  if (hidden.groups > 0) parts.push(`${hidden.groups} issue${hidden.groups > 1 ? "s" : ""}`);
  if (hidden.runs > 0) parts.push(`${hidden.runs} failed run${hidden.runs > 1 ? "s" : ""}`);
  return parts.length === 0 ? null : `${parts.join(" and ")} hidden`;
}

export function RunsToolbar({ config, hidden, onChange }: RunsToolbarProps) {
  const activeCount =
    (config.showFailed === DEFAULT_RUNS_VIEW_CONFIG.showFailed ? 0 : 1) +
    (config.showClosedIssues === DEFAULT_RUNS_VIEW_CONFIG.showClosedIssues ? 0 : 1);
  const summary = hiddenSummary(hidden);
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="sm">
              <Icon name="wand-2" aria-hidden />
              Filter
              {activeCount > 0 ? <CountBadge count={activeCount} tone="accent" /> : null}
            </Button>
          }
        />
        <PopoverContent align="start" className="flex w-64 flex-col gap-3 p-3">
          <FilterRow label="Failed runs">
            <Switch
              checked={config.showFailed}
              onCheckedChange={(showFailed) => onChange({ showFailed })}
            />
          </FilterRow>
          <FilterRow label="Closed issues">
            <Switch
              checked={config.showClosedIssues}
              onCheckedChange={(showClosedIssues) => onChange({ showClosedIssues })}
            />
          </FilterRow>
          {summary === null ? null : <p className="text-xs text-text-tertiary">{summary}</p>}
          {activeCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => onChange(DEFAULT_RUNS_VIEW_CONFIG)}
            >
              Reset filters
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
